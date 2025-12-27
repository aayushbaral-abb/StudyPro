
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Course, CourseLevel, CourseStructure } from '../types';
import { notify } from '../utils/notifications';
import ConfirmModal from './ConfirmModal';

interface DashboardProps {
  onSelectCourse: (course: Course) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectCourse }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Deletion State
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<CourseLevel | ''>('');
  const [structure, setStructure] = useState<CourseStructure>('Semester');
  const [periodValue, setPeriodValue] = useState<string>('');
  const [joinedDate, setJoinedDate] = useState(new Date().toISOString().split('T')[0]);
  const [subjects, setSubjects] = useState<string[]>(['']);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (!error && data) setCourses(data);
    setLoading(false);
  };

  const addSubjectField = () => setSubjects([...subjects, '']);
  const updateSubjectField = (index: number, val: string) => {
    const newSubs = [...subjects];
    newSubs[index] = val;
    setSubjects(newSubs);
  };
  const removeSubjectField = (index: number) => {
    if (subjects.length > 1) setSubjects(subjects.filter((_, i) => i !== index));
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return notify('Please select a degree level.', 'error');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isHigherLevel = type === 'Bachelor' || type === 'Master';
    if (isHigherLevel && !periodValue) return notify(`Please enter your current ${structure}.`, 'error');

    const filteredSubjects = subjects.filter(s => s.trim() !== '');
    if (filteredSubjects.length === 0) return notify('Please enter at least one subject.', 'error');

    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .insert([{
        user_id: user.id,
        name,
        type,
        structure: isHigherLevel ? structure : null,
        period_value: isHigherLevel ? parseInt(periodValue) : null,
        joined_date: joinedDate
      }])
      .select()
      .single();

    if (courseError) {
      notify(courseError.message, 'error');
      return;
    }

    const { error: subError } = await supabase.from('subjects').insert(filteredSubjects.map(subName => ({
      course_id: courseData.id,
      name: subName
    })));

    if (subError) {
      notify(subError.message, 'error');
    } else {
      notify(`Course "${name}" added successfully!`);
      setShowAddModal(false);
      resetForm();
      fetchCourses();
    }
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Step 1: Identify all associated media files via DB relationships
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id')
        .eq('course_id', courseToDelete);
      
      const subjectIds = subjects?.map(s => s.id) || [];

      if (subjectIds.length > 0) {
        const { data: logs } = await supabase
          .from('study_logs')
          .select('id')
          .in('subject_id', subjectIds);
        
        const logIds = logs?.map(l => l.id) || [];

        if (logIds.length > 0) {
          const { data: attachments } = await supabase
            .from('media_attachments')
            .select('file_url')
            .in('study_log_id', logIds);

          if (attachments && attachments.length > 0) {
            // Robustly extract the storage path from the public URL
            // This works regardless of folder structure (old nested or new flat)
            const pathsToRemove = attachments.map(att => {
              const marker = '/student-assets/';
              const index = att.file_url.indexOf(marker);
              if (index !== -1) {
                return decodeURIComponent(att.file_url.substring(index + marker.length));
              }
              return null;
            }).filter((p): p is string => p !== null);
            
            if (pathsToRemove.length > 0) {
              const { error: storageError } = await supabase.storage
                .from('student-assets')
                .remove(pathsToRemove);
              
              if (storageError) {
                console.error('Error cleaning up storage files:', storageError);
              }
            }
          }
        }
      }

      // Step 2: Delete Course from DB (Cascade will remove Subjects, Logs, and Attachment rows)
      const { error } = await supabase.from('courses').delete().eq('id', courseToDelete);
      if (error) throw error;
      
      notify('Course and associated files deleted.', 'info');
      setCourses(courses.filter(c => c.id !== courseToDelete));
    } catch (err: any) {
      notify(`Error deleting course: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setCourseToDelete(null);
    }
  };

  const resetForm = () => {
    setName(''); setType(''); setStructure('Semester'); setPeriodValue('');
    setJoinedDate(new Date().toISOString().split('T')[0]); setSubjects(['']);
  };

  const isHigherLevel = type === 'Bachelor' || type === 'Master';

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          {/* Enhanced Title Styling */}
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-indigo-800 to-indigo-900 tracking-tight pb-1">My Learning Journey</h1>
          <p className="text-gray-500 font-medium text-lg max-w-xl">Track and record your daily study milestones in one professional workspace.</p>
        </div>
        {/* Only show this button if there is at least one course added */}
        {courses.length > 0 && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-3 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            <span>Add New Course</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 animate-pulse text-gray-400 font-black uppercase tracking-widest text-[10px]">Syncing Data...</div>
      ) : courses.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm">
           <h3 className="text-xl font-semibold text-gray-800 mb-8">Start your academic journey today.</h3>
           <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">Add First Course</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course) => (
            <div key={course.id} onClick={() => onSelectCourse(course)} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-indigo-100/40 transition-all cursor-pointer group relative flex flex-col h-[300px]">
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-indigo-50 text-indigo-600 border-indigo-100">
                    {course.type}
                  </span>
                  {course.period_value && (
                    <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-100">
                      {course.structure} {course.period_value}
                    </span>
                  )}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCourseToDelete(course.id); }} 
                  className="p-2 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <h3 className="text-3xl font-black text-gray-900 group-hover:text-indigo-600 transition truncate leading-tight mb-2">
                {course.name}
              </h3>
              <div className="mt-auto pt-6 flex items-center text-indigo-600 text-[10px] font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                Open Tracker <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Enrollment Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-indigo-950/40 backdrop-blur-md flex items-center justify-center p-6 z-[60] overflow-y-auto"
          onClick={(e) => {
            // Close if clicking the backdrop (the container itself)
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl animate-in zoom-in duration-300 my-auto">
            <h2 className="text-4xl font-black text-gray-900 mb-8">Add Course</h2>
            <form onSubmit={handleAddCourse} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">Course Title</label>
                <input 
                  type="text" 
                  required 
                  className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-6 py-4 outline-none font-medium placeholder:font-normal text-gray-800 text-lg shadow-inner" 
                  placeholder="e.g: General,Science,Managenent,CSIT,BBA,BBS" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">Degree Type</label>
                  <select required className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-6 py-4 outline-none font-medium text-gray-800" value={type} onChange={(e) => setType(e.target.value as CourseLevel)}>
                    <option value="" disabled>Select Level</option>
                    <option value="SEE">SEE</option>
                    <option value="+2">+2</option>
                    <option value="Bachelor">Bachelor</option>
                    <option value="Master">Master</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-1">Start Date</label>
                  <input type="date" required className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-6 py-4 outline-none font-medium text-gray-800" value={joinedDate} onChange={(e) => setJoinedDate(e.target.value)} />
                </div>
              </div>

              {isHigherLevel && (
                <div className="grid grid-cols-2 gap-6 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 animate-in slide-in-from-top-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Academic Structure</label>
                    <select className="w-full border-2 border-white bg-white rounded-2xl px-6 py-4 outline-none font-medium text-gray-800" value={structure} onChange={(e) => setStructure(e.target.value as CourseStructure)}>
                      <option value="Semester">Semester-wise</option>
                      <option value="Yearly">Yearly-wise</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Current {structure}</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="12" 
                      required 
                      className="w-full border-2 border-white bg-white rounded-2xl px-6 py-4 outline-none font-medium placeholder:font-normal text-gray-800" 
                      placeholder="Value" 
                      value={periodValue} 
                      onChange={(e) => setPeriodValue(e.target.value)} 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Subjects List</label>
                  <button type="button" onClick={addSubjectField} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Add Subject
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {subjects.map((sub, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="text" 
                        required 
                        className="flex-1 border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 outline-none font-medium placeholder:font-normal text-gray-800" 
                        placeholder={`Subject Name`} 
                        value={sub} 
                        onChange={(e) => updateSubjectField(idx, e.target.value)} 
                      />
                      {subjects.length > 1 && (
                        <button type="button" onClick={() => removeSubjectField(idx)} className="p-3 text-gray-300 hover:text-rose-500">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-4 pt-6">
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1 px-8 py-5 border-2 border-gray-100 rounded-2xl text-gray-400 font-black uppercase tracking-widest text-[10px]">Cancel</button>
                <button type="submit" className="flex-1 px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-indigo-100">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deletion */}
      <ConfirmModal 
        isOpen={!!courseToDelete}
        title="Delete Course?"
        message="This will permanently delete this course and all associated study logs, notes, and media files from your dashboard. This action cannot be undone."
        confirmText="Delete Forever"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setCourseToDelete(null)}
      />
    </div>
  );
};

export default Dashboard;
