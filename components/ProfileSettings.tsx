import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { Profile } from '../types';
import { notify } from '../utils/notifications';

interface ProfileSettingsProps {
  user: User;
  isRecovering?: boolean;
  onRecoveryComplete?: () => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, isRecovering, onRecoveryComplete }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialFullName, setInitialFullName] = useState('');
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setProfile(data);
      setFullName(data.full_name || '');
      setInitialFullName(data.full_name || '');
      setAvatarUrl(data.avatar_url);
      setInitialAvatarUrl(data.avatar_url);
    } else {
      setFullName(user.user_metadata?.full_name || '');
    }
    setLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    });

    if (error) {
      notify(`Profile update failed: ${error.message}`, 'error');
    } else {
      notify('Student identity updated successfully!');
      setInitialFullName(fullName);
      setInitialAvatarUrl(avatarUrl);
    }
    setUpdating(false);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return notify("New passwords do not match!", "error");
    }
    if (newPassword.length < 6) {
      return notify("Password must be at least 6 characters.", "error");
    }

    setPasswordLoading(true);

    try {
      // Step 1: Only re-authenticate if NOT in recovery mode
      if (!isRecovering) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: oldPassword,
        });

        if (signInError) {
          throw new Error("Wrong old password. Verification failed.");
        }
      }

      // Step 2: Update the password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      notify("Account security updated successfully!");
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      
      // Step 3: Clear recovery state in parent if applicable
      if (isRecovering && onRecoveryComplete) {
        onRecoveryComplete();
      }
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const sizeLimit = 50 * 1024 * 1024;
    if (file.size > sizeLimit) {
      notify("Image is too large. Max limit is 50MB.", "error");
      return;
    }

    setUpdating(true);
    const filePath = `avatars/photoid_${user.id}.${file.name.split('.').pop()}`;

    try {
      const { error: uploadError } = await supabase.storage.from('student-assets').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('student-assets').getPublicUrl(filePath);
      await supabase.from('profiles').upsert({ id: user.id, full_name: fullName, avatar_url: publicUrl });

      setAvatarUrl(publicUrl);
      notify('Photo ID synchronized successfully!');
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><div className="animate-spin h-10 w-10 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-3xl mx-auto pb-20 animate-in fade-in duration-700">
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
        
        <div className="bg-slate-900 py-10 px-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-900/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-800/20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
          
          <h2 className="text-2xl md:text-3xl font-bold tracking-[0.2em] uppercase relative z-10 text-white/90">
            {isRecovering ? 'Reset Your Password' : 'Account Management'}
          </h2>
        </div>

        <div className="p-8 md:p-12 -mt-6 bg-white rounded-t-[2.5rem] relative z-20 space-y-16">
          
          {/* Identity Section - Hidden if recovering for focus, or kept if you want user to check name */}
          {!isRecovering && (
            <section>
              <div className="flex items-center space-x-4 mb-8">
                  <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-wide">Student Identity</h3>
              </div>
              
              <form onSubmit={handleUpdate} className="space-y-8">
                <div className="flex flex-col items-center">
                   <div className="relative group w-44 h-44 rounded-full border-8 border-white shadow-2xl overflow-hidden bg-gray-50">
                      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-200"><svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg></div>}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white font-black uppercase text-[10px]">
                        Change Photo
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                      </label>
                   </div>
                   <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Update Photo ID (Max 50MB)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Student Full Name</label>
                  <input type="text" required className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl px-6 py-5 outline-none font-black text-gray-800 focus:border-indigo-200 transition" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <button type="submit" disabled={updating || fullName === initialFullName} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:opacity-50 hover:bg-indigo-700 transition">Update Identity</button>
              </form>
            </section>
          )}

          {/* Security Vault Section */}
          <section>
            <div className="flex items-center space-x-4 mb-8">
                <div className="w-1.5 h-8 bg-rose-500 rounded-full"></div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-wide">
                  {isRecovering ? 'Set New Password' : 'Security Vault'}
                </h3>
            </div>

            {isRecovering && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-bold">
                Recovery mode active. You can set a new password without your old one.
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-6">
              {/* Only show old password field if NOT recovering */}
              {!isRecovering && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Current Password</label>
                  <input type="password" required className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl px-6 py-5 outline-none font-black text-gray-800 focus:border-rose-200 transition" placeholder="Old Password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">New Password</label>
                  <input type="password" required className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl px-6 py-5 outline-none font-black text-gray-800 focus:border-rose-200 transition" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Confirm Password</label>
                  <input type="password" required className="w-full border-2 border-gray-50 bg-gray-50 rounded-2xl px-6 py-5 outline-none font-black text-gray-800 focus:border-rose-200 transition" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={passwordLoading || (!isRecovering && !oldPassword) || !newPassword || !confirmPassword} 
                className="w-full bg-rose-600 text-white py-6 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:opacity-50 hover:bg-rose-700 transition"
              >
                {isRecovering ? 'Save New Password' : 'Update Password'}
              </button>
            </form>
          </section>

        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;