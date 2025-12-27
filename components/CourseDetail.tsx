
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Course, Subject, StudyLog } from '../types';
import StudyDay from './StudyDay';

interface CourseDetailProps {
  course: Course;
  onBack: () => void;
}

const CourseDetail: React.FC<CourseDetailProps> = ({ course, onBack }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentDay, setCurrentDay] = useState(1);
  const [maxDay, setMaxDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [dayLogs, setDayLogs] = useState<Record<string, StudyLog>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(StudyLog & { subject_name: string })[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Ref to track the active request day to prevent race conditions
  const activeRequestRef = useRef<number>(1);

  useEffect(() => {
    const init = async () => {
      await fetchSubjects();
      calculateDay();
    };
    init();
  }, [course]);

  // When currentDay or subjects change, fetch all logs for that day in ONE query
  useEffect(() => {
    if (subjects.length > 0) {
      // Update the active request reference
      activeRequestRef.current = currentDay;
      fetchAllLogsForDay(currentDay);
    }
  }, [currentDay, subjects]);

  // Auto-scroll the slider to the active day whenever it changes
  useEffect(() => {
    const activeBtn = document.getElementById(`day-btn-${currentDay}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest', 
        inline: 'center' 
      });
    }
  }, [currentDay]);

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').eq('course_id', course.id);
    if (data) setSubjects(data);
    setLoading(false);
  };

  const calculateDay = () => {
    // Robust date parsing: Split YYYY-MM-DD to avoid timezone shifts from implicit UTC parsing
    const parts = course.joined_date.split('-');
    // Month is 0-indexed in JS Date
    const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const now = new Date();
    // Normalize to midnight local time for accurate day counting
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const calculatedDay = diff > 0 ? diff : 1;
    
    setCurrentDay(calculatedDay);
    setMaxDay(calculatedDay);
    // Also update ref for initial load
    activeRequestRef.current = calculatedDay;
  };

  const fetchAllLogsForDay = async (day: number) => {
    setFetchingLogs(true);
    const subjectIds = subjects.map(s => s.id);
    
    // Safety check: If there are no subjects, we can't query logs.
    if (subjectIds.length === 0) {
      if (activeRequestRef.current === day) {
        setDayLogs({});
        setFetchingLogs(false);
      }
      return;
    }
    
    // Optimized Query: Fetch logs AND media_attachments in one go
    const { data, error } = await supabase
      .from('study_logs')
      .select('*, media_attachments(*)')
      .in('subject_id', subjectIds)
      .eq('day_number', day)
      .order('created_at', { foreignTable: 'media_attachments', ascending: false });

    // CRITICAL: Only update state if the response matches the currently selected day
    if (activeRequestRef.current === day) {
      if (data) {
        const logMap: Record<string, StudyLog> = {};
        data.forEach((log: any) => {
          logMap[log.subject_id] = log;
        });
        setDayLogs(logMap);
      } else {
        setDayLogs({});
      }
      setFetchingLogs(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const { data } = await supabase
      .from('study_logs')
      .select('*, subjects(name, course_id)')
      .ilike('title', `%${searchQuery}%`);

    if (data) {
      // Filter by current course since join filters are tricky in Supabase without complex RLS or views
      // Safe guard: check if d.subjects exists
      const filtered = data
        .filter((d: any) => d.subjects && d.subjects.course_id === course.id)
        .map((d: any) => ({
          ...d,
          subject_name: d.subjects.name
        }));
      setSearchResults(filtered);
    }
  };

  const selectedDateInfo = useMemo(() => {
    // Reconstruct date based on joined_date + offset
    const parts = course.joined_date.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    date.setDate(date.getDate() + (currentDay - 1));
    return {
      fullDate: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' })
    };
  }, [course.joined_date, currentDay]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 bg-white hover:bg-gray-50 rounded-xl transition shadow-sm border border-gray-100 active:scale-95">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-gray-900 leading-none">{course.name}</h1>
              <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">{course.type}</span>
            </div>
            <p className="text-sm text-gray-500 uppercase tracking-wider font-bold text-[10px]">
              {course.period_value ? (
                `${course.structure === 'Semester' ? 'Semester' : 'Year'} ${course.period_value}`
              ) : (
                'Standard Tracker'
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative group w-full md:w-96">
          <input
            type="text"
            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition group-hover:border-indigo-200"
            placeholder="Search notes by topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </form>
      </div>

      {!isSearching ? (
        <>
          {/* Day Navigation & Info */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center space-x-4 px-2 md:border-r border-gray-100 md:pr-6 min-w-fit">
              <div className="bg-indigo-50 p-3 rounded-2xl">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="leading-tight">
                <h2 className="text-sm font-black text-gray-900">{selectedDateInfo.dayName}</h2>
                <p className="text-xs text-gray-500 font-bold">{selectedDateInfo.fullDate}</p>
              </div>
            </div>
            
            <div className="flex flex-1 overflow-x-auto py-2 gap-2 no-scrollbar scroll-smooth">
              {[...Array(maxDay)].map((_, i) => {
                const dayNum = i + 1;
                return (
                  <button
                    key={dayNum}
                    id={`day-btn-${dayNum}`}
                    onClick={() => setCurrentDay(dayNum)}
                    className={`shrink-0 w-12 h-12 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center border active:scale-90 ${
                      currentDay === dayNum 
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-100 scale-110 z-10' 
                      : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    <span className="text-[8px] uppercase tracking-tighter opacity-70">Day</span>
                    {dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
            {fetchingLogs && (
               <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] z-20 rounded-3xl flex items-center justify-center h-full min-h-[300px]">
                 <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
               </div>
            )}
            {/* 
              By using the composite key of SubjectID-DayNumber, we force React to 
              unmount the old StudyDay component and mount a new one. 
              This guarantees zero state mismatch between days.
            */}
            {subjects.map(subject => (
              <StudyDay 
                key={`${subject.id}-${currentDay}`} 
                subject={subject} 
                dayNumber={currentDay}
                initialLog={dayLogs[subject.id]?.day_number === currentDay ? dayLogs[subject.id] : undefined}
                refreshLogs={() => fetchAllLogsForDay(currentDay)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Search Results for "{searchQuery}"</h2>
            <button onClick={() => setIsSearching(false)} className="text-indigo-600 font-semibold hover:underline bg-indigo-50 px-4 py-2 rounded-xl transition hover:bg-indigo-100">Back to Tracker</button>
          </div>
          
          {searchResults.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-lg font-medium">No matches found in this course.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map(res => (
                <div 
                  key={res.id} 
                  className="p-6 border-2 border-gray-50 bg-gray-50/30 rounded-[2rem] hover:border-indigo-200 hover:bg-white transition cursor-pointer group shadow-sm"
                  onClick={() => {
                    setCurrentDay(res.day_number);
                    setIsSearching(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-gray-900 group-hover:text-indigo-600 transition text-lg">{res.title || 'Untitled Session'}</h4>
                      <p className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-wider">{res.subject_name} • Day {res.day_number}</p>
                    </div>
                  </div>
                  {res.content_text && <p className="text-sm text-gray-600 mt-4 line-clamp-3 leading-relaxed italic border-l-4 border-indigo-100 pl-4 bg-white/50 py-2 rounded-r-xl">"{res.content_text}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseDetail;
