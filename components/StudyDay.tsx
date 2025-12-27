
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Subject, StudyLog, MediaAttachment } from '../types';
import MediaCapture from './MediaCapture';
import { notify } from '../utils/notifications';
import ConfirmModal from './ConfirmModal';

interface StudyDayProps {
  subject: Subject;
  dayNumber: number;
  initialLog?: StudyLog;
  refreshLogs: () => void;
}

const StudyDay: React.FC<StudyDayProps> = ({ subject, dayNumber, initialLog, refreshLogs }) => {
  const [log, setLog] = useState<StudyLog | null>(initialLog || null);
  // Initialize attachments from the initialLog if they exist (pre-fetched via join)
  const [attachments, setAttachments] = useState<MediaAttachment[]>(initialLog?.media_attachments || []);
  const [isEditing, setIsEditing] = useState(false);
  const [noteTitle, setNoteTitle] = useState(initialLog?.title || '');
  const [noteText, setNoteText] = useState(initialLog?.content_text || '');
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment | null>(null);
  const [downloading, setDownloading] = useState(false);
  
  // Deletion State
  const [mediaToDelete, setMediaToDelete] = useState<{id: string, fileUrl: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // When props change (day switch), update state
    setLog(initialLog || null);
    setNoteTitle(initialLog?.title || '');
    setNoteText(initialLog?.content_text || '');
    
    // If we have pre-fetched attachments, use them. 
    // Otherwise, empty array (reset) - NO separate fetch to prevent N+1 waterfall.
    if (initialLog?.media_attachments) {
      setAttachments(initialLog.media_attachments);
      setLoadingMedia(false);
    } else {
      setAttachments([]);
      setLoadingMedia(false);
    }

  }, [initialLog]); 

  const saveNote = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const payload = {
        subject_id: subject.id,
        user_id: user.id,
        day_number: dayNumber,
        title: noteTitle,
        content_text: noteText,
        ...(log?.id ? { id: log.id } : {})
      };

      const { data, error } = await supabase
        .from('study_logs')
        .upsert(payload, { onConflict: 'subject_id,day_number' })
        .select('*, media_attachments(*)') // Fetch back attachments on save to keep sync
        .single();

      if (error) throw error;
      if (data) {
         setLog(data);
         // If response includes attachments (it might be empty if new), sync them, 
         // but usually we want to keep current attachments state unless the server changed something drastic.
         // Since upsert of log doesn't change attachments, we can mostly rely on local state, 
         // but updating the 'log' object is good practice.
      }

      notify(`Study notes for ${subject.name} saved!`);
      setIsEditing(false);
      refreshLogs(); // Refresh parent to ensure global state consistency
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const initiateDelete = (e: React.MouseEvent, id: string, fileUrl: string) => {
    e.stopPropagation();
    setMediaToDelete({ id, fileUrl });
  };

  const executeDelete = async () => {
    if (!mediaToDelete || !log) return;
    setIsDeleting(true);
    try {
      const marker = '/student-assets/';
      const index = mediaToDelete.fileUrl.indexOf(marker);
      
      if (index !== -1) {
        const filePath = decodeURIComponent(mediaToDelete.fileUrl.substring(index + marker.length));
        const { error: storageError } = await supabase.storage.from('student-assets').remove([filePath]);
        if (storageError) console.warn("Storage deletion warning:", storageError);
      } else {
         console.warn("Could not parse storage path from URL:", mediaToDelete.fileUrl);
      }

      await supabase.from('media_attachments').delete().eq('id', mediaToDelete.id);
      
      setAttachments(prev => prev.filter(a => a.id !== mediaToDelete.id));
      
      if (selectedMedia?.id === mediaToDelete.id) {
        setSelectedMedia(null);
      }

      notify('Media asset deleted.', 'info');
    } catch (err: any) {
      notify(`Deletion failed: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setMediaToDelete(null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      notify('Download initiated.');
    } catch (err) {
      console.error('Download failed:', err);
      notify('Download failed. Try "Open in New Tab" instead.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = (fileName: string, type: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (type === 'image') return null;
    
    if (ext === 'pdf') return <svg className="w-10 h-10 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" /><path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>;
    if (['doc', 'docx'].includes(ext!)) return <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>;
    if (['xls', 'xlsx', 'csv'].includes(ext!)) return <svg className="w-10 h-10 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 011 1v7a1 1 0 11-2 0V9a1 1 0 011-1z" clipRule="evenodd" /></svg>;
    if (['ppt', 'pptx'].includes(ext!)) return <svg className="w-10 h-10 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>;
    if (type === 'audio') return <svg className="w-10 h-10 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>;
    if (type === 'video') return <svg className="w-10 h-10 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;
    return <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>;
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col transition-all hover:shadow-xl hover:shadow-indigo-50/30">
      <div className="px-8 py-6 flex justify-between items-center border-b border-gray-50 bg-gray-50/20">
        <div className="flex items-center space-x-4">
          <div className="w-2 h-10 bg-indigo-600 rounded-full shadow-lg shadow-indigo-100"></div>
          <div><h3 className="text-xl font-black text-gray-900 leading-none">{subject.name}</h3></div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {isEditing ? (
          <div className="space-y-4 animate-in slide-in-from-top-4">
            <input type="text" className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl px-6 py-4 outline-none font-black text-gray-800 focus:bg-white focus:border-indigo-500 transition" placeholder="Session Topic" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
            <textarea className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl px-6 py-4 outline-none min-h-[160px] font-medium focus:bg-white focus:border-indigo-500 transition" placeholder="Notes for today's session..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <div className="flex space-x-3 pt-2">
              <button onClick={saveNote} className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase shadow-lg shadow-indigo-100 active:scale-95 transition">Save Session</button>
              <button onClick={() => setIsEditing(false)} className="px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl text-xs font-black uppercase active:scale-95 transition">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
             <div onClick={() => setIsEditing(true)} className="cursor-pointer group">
                <h4 className={`text-xl font-black ${noteTitle ? 'text-gray-900' : 'text-gray-300 italic'} group-hover:text-indigo-600 transition`}>{noteTitle || 'Add Topic...'}</h4>
                <div className="text-gray-600 bg-indigo-50/20 p-5 rounded-[1.5rem] mt-4 border border-transparent group-hover:border-indigo-100 transition whitespace-pre-wrap leading-relaxed">
                  {noteText || <span className="text-gray-300 italic">No notes captured...</span>}
                </div>
             </div>
             
             <div className="border-t border-gray-50 pt-6">
                <div className="flex items-center justify-between mb-4 px-1">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Multimedia Vault</span>
                   {log ? (
                     <MediaCapture logId={log.id} courseId={subject.course_id} onUpload={(att) => { setAttachments(prev => [att, ...prev]); notify('Asset synchronized!'); }} />
                   ) : (
                     <button 
                       onClick={() => setIsEditing(true)}
                       className="px-3 py-1.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-gray-100 transition"
                       title="Save a note to enable uploads"
                     >
                       Start Session to Upload
                     </button>
                   )}
                </div>
                
                {attachments.length === 0 ? (
                  <div className="py-10 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 text-center flex flex-col items-center">
                    {loadingMedia ? (
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Loading Media...</p>
                      </div>
                    ) : (
                      <>
                        <svg className="w-10 h-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                        <p className="text-[10px] font-black uppercase text-gray-300 tracking-widest">Vault is empty</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {attachments.map(att => (
                      <div 
                        key={att.id} 
                        onClick={() => setSelectedMedia(att)}
                        className="relative group rounded-3xl overflow-hidden bg-white h-32 border border-gray-100 cursor-pointer hover:shadow-2xl transition-all"
                      >
                        {att.type === 'image' ? (
                          <img src={att.file_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-white">
                            {getFileIcon(att.file_name, att.type)}
                            <span className="text-[9px] font-black uppercase text-gray-500 text-center line-clamp-2 mt-2 leading-tight px-1">
                              {att.file_name}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 transition duration-300" />
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Media Lightbox Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedMedia(null)}>
          
          {/* Toolbar */}
          <div className="absolute top-6 right-6 flex items-center space-x-4 z-50" onClick={e => e.stopPropagation()}>
            <a 
              href={selectedMedia.file_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition group"
              title="Open in New Tab"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            
            <button 
              onClick={(e) => handleDownload(e, selectedMedia.file_url, selectedMedia.file_name)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition"
              title="Download"
            >
              {downloading ? (
                 <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
              )}
            </button>

            <button 
              onClick={(e) => initiateDelete(e, selectedMedia.id, selectedMedia.file_url)}
              className="p-3 bg-rose-500/80 hover:bg-rose-600 text-white rounded-full backdrop-blur-md transition"
              title="Delete"
            >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>

            <button 
              onClick={() => setSelectedMedia(null)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition ml-4"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Content */}
          <div className="w-full h-full flex items-center justify-center p-4 md:p-10" onClick={e => e.stopPropagation()}>
             {selectedMedia.type === 'image' && (
               <img src={selectedMedia.file_url} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
             )}
             {selectedMedia.type === 'video' && (
               <video src={selectedMedia.file_url} controls className="max-w-full max-h-full rounded-lg shadow-2xl" />
             )}
             {selectedMedia.type === 'audio' && (
               <div className="bg-white p-8 rounded-3xl flex flex-col items-center space-y-4 shadow-2xl">
                  <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                     <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                  </div>
                  <audio src={selectedMedia.file_url} controls className="w-80" />
                  <p className="font-bold text-gray-700">{selectedMedia.file_name}</p>
               </div>
             )}
             {(selectedMedia.type === 'document' || selectedMedia.type === 'note') && (
                <div className="bg-white p-10 rounded-3xl flex flex-col items-center space-y-6 text-center max-w-sm shadow-2xl">
                   {getFileIcon(selectedMedia.file_name, selectedMedia.type)} 
                   <div>
                     <h3 className="text-xl font-bold text-gray-900 truncate max-w-xs">{selectedMedia.file_name}</h3>
                     <p className="text-gray-500 mt-2">This file type cannot be previewed directly.</p>
                   </div>
                   <a 
                     href={selectedMedia.file_url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-700 transition shadow-lg"
                   >
                     Open Document
                   </a>
                </div>
             )}
          </div>
        </div>
      )}

      {/* Media Deletion Modal */}
      <ConfirmModal 
        isOpen={!!mediaToDelete}
        title="Delete Asset?"
        message="Are you sure you want to permanently remove this file from your academic vault? This action cannot be undone."
        confirmText="Delete File"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setMediaToDelete(null)}
      />
    </div>
  );
};

export default StudyDay;
