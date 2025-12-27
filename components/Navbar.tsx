
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface NavbarProps {
  user: User;
  onNavigate: (view: 'dashboard' | 'profile' | 'course') => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onNavigate }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Store timestamp in state to prevent reloading image on every render
  const [avatarTs, setAvatarTs] = useState(Date.now());

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setProfile(data);
          setAvatarTs(Date.now());
        } else {
          // Fallback to user metadata if profile table entry isn't ready
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || 'Student',
            avatar_url: null
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Listen for profile changes to update header immediately across sessions
    const profileChannel = supabase
      .channel('navbar-profile-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
             setProfile(payload.new as Profile);
             setAvatarTs(Date.now()); // Update timestamp only when data actually changes
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user.id, user.user_metadata?.full_name]);

  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center space-x-2 cursor-pointer group"
          onClick={() => onNavigate('dashboard')}
        >
          <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition shadow-indigo-100 shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-indigo-900 hidden md:block">StudyPro</span>
        </div>

        <div className="flex items-center space-x-3 md:space-x-8">
          
          <div 
            onClick={() => onNavigate('profile')}
            className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 py-1.5 px-3 rounded-2xl border border-transparent hover:border-gray-100 transition"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50 overflow-hidden border-2 border-indigo-200 shadow-sm shrink-0 flex items-center justify-center">
              {profile?.avatar_url ? (
                // Use state-based timestamp for cache busting only on updates
                <img src={`${profile.avatar_url}?t=${avatarTs}`} alt="Photo ID" className="w-full h-full object-cover" />
              ) : (
                <div className="text-indigo-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                </div>
              )}
            </div>
            <div className="hidden sm:block leading-none">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {loading ? 'Fetching...' : profile?.full_name || 'New Student'}
              </p>
              <p className="text-[10px] text-indigo-500 font-medium uppercase tracking-[0.15em]">Account</p>
            </div>
          </div>

          <button 
            onClick={() => supabase.auth.signOut()}
            className="text-rose-500 hover:bg-rose-50 p-2 md:px-4 md:py-2 rounded-xl border border-transparent hover:border-rose-100 transition"
            title="Logout"
          >
            <svg className="w-5 h-5 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="hidden md:inline font-bold text-sm">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
