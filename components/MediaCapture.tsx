
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { MediaAttachment, MediaType } from '../types';
import { notify } from '../utils/notifications';

// --- Crop Editor Component ---

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const CropEditor = ({ imageSrc, onCancel, onSave }: { imageSrc: string, onCancel: () => void, onSave: (blob: Blob) => void }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  // Initial crop: Full image (0% offset, 100% dimension)
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  
  const interactionRef = useRef<{
    startX: number;
    startY: number;
    startCrop: typeof crop;
    mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
  } | null>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!interactionRef.current || !imgRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    
    const { startX, startY, startCrop, mode } = interactionRef.current;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Calculate delta in percentages relative to image size
    const deltaX = ((e.clientX - startX) / rect.width) * 100;
    const deltaY = ((e.clientY - startY) / rect.height) * 100;

    let newCrop = { ...startCrop };

    if (mode === 'move') {
      newCrop.x = clamp(startCrop.x + deltaX, 0, 100 - startCrop.width);
      newCrop.y = clamp(startCrop.y + deltaY, 0, 100 - startCrop.height);
    } else {
      // Resize logic with constraints
      const minSize = 10; // Minimum 10% size

      if (mode.includes('n')) {
        const maxY = startCrop.y + startCrop.height - minSize;
        newCrop.y = clamp(startCrop.y + deltaY, 0, maxY);
        newCrop.height = startCrop.height + (startCrop.y - newCrop.y);
      }
      if (mode.includes('s')) {
         const maxHeight = 100 - startCrop.y;
         newCrop.height = clamp(startCrop.height + deltaY, minSize, maxHeight);
      }
      if (mode.includes('w')) {
        const maxX = startCrop.x + startCrop.width - minSize;
        newCrop.x = clamp(startCrop.x + deltaX, 0, maxX);
        newCrop.width = startCrop.width + (startCrop.x - newCrop.x);
      }
      if (mode.includes('e')) {
        const maxWidth = 100 - startCrop.x;
        newCrop.width = clamp(startCrop.width + deltaX, minSize, maxWidth);
      }
    }

    setCrop(newCrop);
  }, []);

  const createHandler = (mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      interactionRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
        mode
      };
    },
    onPointerMove: handlePointerMove,
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.releasePointerCapture(e.pointerId);
      interactionRef.current = null;
    }
  });

  const handleSave = () => {
    if (!imgRef.current) return;
    const canvas = document.createElement('canvas');
    const img = imgRef.current;
    
    // Map percentages to natural image dimensions
    const scaleX = img.naturalWidth / 100;
    const scaleY = img.naturalHeight / 100;
    
    const pixelX = crop.x * scaleX;
    const pixelY = crop.y * scaleY;
    const pixelW = crop.width * scaleX;
    const pixelH = crop.height * scaleY;

    canvas.width = pixelW;
    canvas.height = pixelH;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
    
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 z-[10020] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="flex items-center justify-between p-6 bg-black/50 backdrop-blur-md z-10 shrink-0">
        <button onClick={onCancel} className="text-white font-bold uppercase text-xs tracking-widest px-4 py-2 rounded-lg hover:bg-white/10 transition">Retake</button>
        <h3 className="text-white font-black uppercase tracking-widest text-sm">Crop Image</h3>
        <button onClick={handleSave} className="bg-indigo-600 text-white font-bold uppercase text-xs tracking-widest px-6 py-2 rounded-lg hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/30">Done</button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gray-900 p-8 touch-none">
        <div className="relative shadow-2xl">
          <img 
            ref={imgRef} 
            src={imageSrc} 
            className="max-h-[70vh] max-w-full block select-none pointer-events-none" 
            draggable={false}
          />
          
          {/* Overlay: Using box-shadow to darken outside area */}
          <div 
            className="absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] cursor-move touch-none"
            style={{ 
              left: `${crop.x}%`, 
              top: `${crop.y}%`, 
              width: `${crop.width}%`, 
              height: `${crop.height}%` 
            }}
            {...createHandler('move')}
          >
             {/* Grid Lines (Rule of Thirds) */}
             <div className="absolute inset-0 flex flex-col pointer-events-none opacity-40">
                <div className="flex-1 border-b border-white/50"></div>
                <div className="flex-1 border-b border-white/50"></div>
                <div className="flex-1"></div>
             </div>
             <div className="absolute inset-0 flex pointer-events-none opacity-40">
                <div className="flex-1 border-r border-white/50"></div>
                <div className="flex-1 border-r border-white/50"></div>
                <div className="flex-1"></div>
             </div>

             {/* Handles */}
             <div className="absolute -top-3 -left-3 w-8 h-8 border-t-4 border-l-4 border-white cursor-nw-resize p-2" {...createHandler('nw')} />
             <div className="absolute -top-3 -right-3 w-8 h-8 border-t-4 border-r-4 border-white cursor-ne-resize p-2" {...createHandler('ne')} />
             <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-4 border-l-4 border-white cursor-sw-resize p-2" {...createHandler('sw')} />
             <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-4 border-r-4 border-white cursor-se-resize p-2" {...createHandler('se')} />
          </div>
        </div>
      </div>
      <div className="p-4 text-center text-gray-400 text-[10px] uppercase tracking-widest font-bold shrink-0">Drag corners to resize • Drag box to move</div>
    </div>
  );
};

// --- Main MediaCapture Component ---

interface MediaCaptureProps {
  logId: string;
  courseId: string;
  onUpload: (attachment: MediaAttachment) => void;
}

const MediaCapture: React.FC<MediaCaptureProps> = ({ logId, courseId, onUpload }) => {
  const [isCapturing, setIsCapturing] = useState<'photo' | 'audio' | 'video' | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null); // For Crop UI
  const [recording, setRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null); // For Audio Review
  const [uploading, setUploading] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopStream();
    };
  }, []);

  // Cleanup for captured image when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (capturedImage) URL.revokeObjectURL(capturedImage);
    };
  }, [capturedImage]);

  useEffect(() => {
    if (isCapturing && isCapturing !== 'audio' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCapturing]);

  const getSupportedMimeType = (type: 'video' | 'audio') => {
    const videoTypes = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4', 'video/quicktime'];
    const audioTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/aac'];
    
    const possibleTypes = type === 'video' ? videoTypes : audioTypes;
    return possibleTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
  };

  const startStream = async (type: 'photo' | 'video' | 'audio') => {
    try {
      if (streamRef.current) stopStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: type !== 'audio' ? { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } : false,
        audio: true
      });
      
      if (!isMounted.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      setIsCapturing(type);
      setRecordedAudio(null); // Reset previous recording

      if (type === 'audio' || type === 'video') setupRecorder(stream, type);
    } catch (err) {
      console.error(err);
      notify('Media access denied. Please check your browser permissions.', 'error');
      setIsCapturing(null);
    }
  };

  const setupRecorder = (stream: MediaStream, type: 'video' | 'audio') => {
    const mimeType = getSupportedMimeType(type);
    if (!mimeType) {
        notify('Your browser does not support recording media.', 'error');
        return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    
    recorder.onstop = async () => {
      if (!isMounted.current) return;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      
      if (type === 'audio') {
        // For audio, we save to state for review
        setRecordedAudio(blob);
        setRecording(false);
      } else {
        // For video (if implemented similarly later), or direct upload
        await uploadMedia(blob, type);
      }
      chunksRef.current = [];
    };
    
    mediaRecorderRef.current = recorder;
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    
    setShowFlash(true);
    setTimeout(() => {
      if (isMounted.current) setShowFlash(false);
    }, 150);

    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Instead of uploading directly, we generate a blob/url and switch to Crop Mode
    canvas.toBlob((blob) => {
      if (blob && isMounted.current) {
         const url = URL.createObjectURL(blob);
         setCapturedImage(url);
         // Stop the stream as we have the image
         stopStream();
      }
    }, 'image/jpeg', 1.0);
  };

  const handleCropSave = async (blob: Blob) => {
    // Revoke the temporary URL
    if (capturedImage) URL.revokeObjectURL(capturedImage);
    setCapturedImage(null);
    
    await uploadMedia(blob, 'image');
  };

  const handleCropCancel = () => {
     if (capturedImage) URL.revokeObjectURL(capturedImage);
     setCapturedImage(null);
     // Re-open camera
     startStream('photo');
  };

  // --- Audio Review Handlers ---

  const handleSaveAudio = () => {
    if (recordedAudio) {
      // UX Improvement: Optimistically show spinner and close modal
      setUploading(true);
      setIsCapturing(null);
      // Fire and forget upload (it handles its own errors and cleanup)
      uploadMedia(recordedAudio, 'audio');
    }
  };

  const handleDiscardAudio = () => {
    // User requested behavior: Discard implies unloading/closing the popup entirely.
    stopStream();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: MediaType = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    await uploadMedia(file, type);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadMedia = async (blob: Blob | File, type: MediaType) => {
    const fileSizeInBytes = blob.size;
    const sizeLimit = 50 * 1024 * 1024; // 50MB

    if (fileSizeInBytes > sizeLimit) {
      notify('File too large. Maximum size limit is 50MB.', 'error');
      if (isMounted.current) {
        setIsCapturing(null);
        setUploading(false);
        if (recording) setRecording(false);
      }
      return;
    }

    setUploading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        notify('Authentication required to upload.', 'error');
        setUploading(false);
        return;
    }

    const uniqueId = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    
    let storageFileName: string;
    let dbFileName: string;
    
    if (blob instanceof File) {
      const file = blob as File;
      const lastDotIndex = file.name.lastIndexOf('.');
      let baseName = file.name;
      let ext = '';
      if (lastDotIndex !== -1) {
        baseName = file.name.substring(0, lastDotIndex);
        ext = file.name.substring(lastDotIndex + 1);
      }
      const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
      storageFileName = `${uniqueId}_${sanitizedBaseName}.${ext}`;
      dbFileName = file.name;
    } else {
      const ext = type === 'image' ? 'jpg' : 'webm';
      storageFileName = `${uniqueId}_${type}_${timestamp}.${ext}`;
      const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
      const timeStr = new Date().toLocaleTimeString().replace(/:/g, '-');
      dbFileName = `${type.charAt(0).toUpperCase() + type.slice(1)} Capture ${dateStr} ${timeStr}.${ext}`;
    }
    
    const filePath = `${user.id}/${storageFileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('student-assets').upload(filePath, blob);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('student-assets').getPublicUrl(filePath);
      
      const { data, error } = await supabase.from('media_attachments').insert([{
        study_log_id: logId, 
        type, 
        file_url: publicUrl, 
        file_name: dbFileName
      }]).select().single();

      if (error) throw error;
      
      // CRITICAL: Only call callback if component is still mounted
      if (isMounted.current && data) onUpload(data);
      
    } catch (err: any) {
      notify(`Storage error: ${err.message}`, 'error');
    } finally {
      if (isMounted.current) {
         setUploading(false);
         // Ensure popup is unloaded (closed) after a successful save
         setIsCapturing(null);
         setRecordedAudio(null);
      }
    }
  };

  const stopStream = () => { 
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop()); 
      streamRef.current = null;
    }
    if (isMounted.current) {
        setIsCapturing(null); 
        setRecording(false); 
        setRecordedAudio(null);
    }
  };

  // Helper to determine if we can dismiss the modal (not recording and not reviewing)
  const isAudio = isCapturing === 'audio';
  const canDismiss = !isAudio || (!recording && !recordedAudio);

  // Render Strategy: 
  // 1. If we have a captured image -> Show Crop Editor
  // 2. If capturing (video/audio) -> Show Capture UI
  // 3. Default -> Show Upload/Capture Buttons

  if (capturedImage) {
      return (
        <CropEditor 
          imageSrc={capturedImage} 
          onCancel={handleCropCancel} 
          onSave={handleCropSave} 
        />
      );
  }

  return (
    <div className="relative flex items-center space-x-2">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
      
      {uploading ? (
        <div className="px-4 py-2 bg-indigo-50 rounded-2xl flex items-center space-x-3 border border-indigo-100 animate-pulse">
          <div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Saving to Vault...</span>
        </div>
      ) : (
        <>
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="group flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition shadow-sm border border-indigo-100/50" 
            title="Upload Document"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Upload</span>
          </button>
          
          <button onClick={() => startStream('photo')} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition shadow-sm border border-indigo-100/50" title="Camera Capture">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
          </button>
          
          <button onClick={() => startStream('audio')} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition shadow-sm border border-indigo-100/50" title="Audio Recorder">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </button>
        </>
      )}

      {isCapturing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-in fade-in duration-300">
          
          {/* Backdrop - Only clickable to close if we are not in active recording/review state */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={canDismiss ? stopStream : undefined}
          ></div>

          {/* Modal Content */}
          <div className={`relative bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col items-center justify-center ${isCapturing === 'audio' ? 'w-full max-w-sm p-8 mx-4' : 'w-full h-full bg-black'}`}>
            
            {/* Close Button - Hide if recording/reviewing audio to enforce Discard/Save flow */}
            {canDismiss && (
                <button 
                    onClick={stopStream} 
                    className={`absolute top-6 right-6 z-[10010] p-3 rounded-full transition active:scale-95 ${isCapturing === 'audio' ? 'text-gray-400 hover:bg-gray-100' : 'text-white/80 bg-black/20 hover:bg-black/40 backdrop-blur-md'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}

            {isCapturing !== 'audio' ? (
              // --- Video/Photo View (Full Screen) ---
              <>
                  <div className="relative w-full h-full">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="absolute inset-0 w-full h-full object-cover" 
                      />
                      
                      <div className="absolute inset-0 pointer-events-none opacity-20">
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white"></div>
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white"></div>
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white"></div>
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white"></div>
                      </div>

                      {showFlash && <div className="absolute inset-0 bg-white z-[10005] animate-out fade-out duration-150"></div>}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-10 pb-16 z-[10010] flex flex-col items-center">
                      <p className="text-white/90 font-black uppercase tracking-[0.2em] text-[10px] mb-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        Tap to Capture
                      </p>
                      <button 
                        onClick={capturePhoto} 
                        className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full border-4 border-white flex items-center justify-center p-0 active:scale-90 transition-all shadow-2xl hover:bg-white/30"
                      >
                        <div className="w-16 h-16 bg-white rounded-full"></div>
                      </button>
                  </div>
              </>
            ) : (
              // --- Audio Popup View ---
              <div className="flex flex-col items-center w-full">
                   <h3 className="text-xl font-black text-gray-900 uppercase tracking-wide mb-8">Voice Recorder</h3>
                   
                   {recordedAudio ? (
                     // Review State
                     <div className="w-full space-y-6 animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-50 rounded-2xl p-6 flex items-center justify-center">
                           <audio controls src={URL.createObjectURL(recordedAudio)} className="w-full accent-indigo-600" />
                        </div>
                        <div className="flex space-x-3 w-full">
                           <button 
                             onClick={handleDiscardAudio}
                             className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl font-black uppercase text-[10px] tracking-widest transition active:scale-95"
                           >
                             Discard
                           </button>
                           <button 
                             onClick={handleSaveAudio}
                             className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-200 transition active:scale-95"
                           >
                             Save
                           </button>
                        </div>
                     </div>
                   ) : (
                     // Recording State
                     <div className="flex flex-col items-center space-y-8 animate-in zoom-in-95 duration-200">
                         <div className="relative">
                           {recording && (
                             <>
                              <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-20 pointer-events-none"></div>
                              <div className="absolute -inset-4 bg-rose-500 rounded-full animate-ping delay-100 opacity-10 pointer-events-none"></div>
                             </>
                           )}
                           <button 
                             onClick={() => { 
                                 if (recording) { 
                                     mediaRecorderRef.current?.stop(); 
                                 } else { 
                                     chunksRef.current = []; 
                                     mediaRecorderRef.current?.start(); 
                                     setRecording(true); 
                                 } 
                             }} 
                             className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90 ${recording ? 'bg-rose-500 text-white shadow-rose-200' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}
                           >
                             {recording ? (
                               <div className="w-8 h-8 bg-white rounded-lg"></div>
                             ) : (
                               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                             )}
                           </button>
                         </div>
                         <p className={`font-mono text-xs uppercase tracking-widest font-bold ${recording ? 'text-rose-500 animate-pulse' : 'text-gray-400'}`}>
                            {recording ? 'Recording...' : 'Tap to Record'}
                         </p>
                     </div>
                   )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaCapture;
