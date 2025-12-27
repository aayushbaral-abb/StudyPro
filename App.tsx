import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import AuthUI from './components/AuthUI';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import ProfileSettings from './components/ProfileSettings';
import CourseDetail from './components/CourseDetail';
import Toast from './components/Toast';
import { Course } from './types';
import { NotificationType } from './utils/notifications';

interface NotificationState {
  id: number;
  message: string;
  type: NotificationType;
}

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'profile' | 'course'>('dashboard');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  // New state to track recovery mode
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      // If user comes from recovery email, force them to profile view
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true);
        setView('profile');
      }
    });

    const handleNotification = (event: any) => {
      const { message, type } = event.detail;
      const id = Date.now();
      setNotifications(prev => [...prev, { id, message, type }]);
    };

    window.addEventListener('app:notification', handleNotification);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('app:notification', handleNotification);
    };
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const navigateToCourse = (course: Course) => {
    setSelectedCourse(course);
    setView('course');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {!session ? (
        <AuthUI />
      ) : (
        <>
          <Navbar 
            user={session.user} 
            onNavigate={(v) => {
              setView(v);
              if (v !== 'course') setSelectedCourse(null);
            }} 
          />
          
          <main className="flex-grow container mx-auto px-4 py-8">
            {view === 'dashboard' && (
              <Dashboard onSelectCourse={navigateToCourse} />
            )}
            {view === 'profile' && (
              <ProfileSettings 
                user={session.user} 
                isRecovering={isRecovering} 
                onRecoveryComplete={() => setIsRecovering(false)} 
              />
            )}
            {view === 'course' && selectedCourse && (
              <CourseDetail course={selectedCourse} onBack={() => setView('dashboard')} />
            )}
          </main>

          <footer className="bg-white border-t border-gray-100 py-8 text-center">
            <p className="text-gray-400 text-xs font-black uppercase tracking-[0.25em]">
              StudyPro &copy; {new Date().getFullYear()} — All rights reserved
            </p>
          </footer>
        </>
      )}

      <div className="fixed bottom-6 right-6 z-[20000] flex flex-col space-y-4 pointer-events-none">
        {notifications.map(n => (
          <Toast 
            key={n.id} 
            message={n.message} 
            type={n.type} 
            onClose={() => removeNotification(n.id)} 
          />
        ))}
      </div>
    </div>
  );
};

export default App;