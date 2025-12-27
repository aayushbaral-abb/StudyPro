import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { notify } from '../utils/notifications';

const AuthUI: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false); // New State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        // FORGOT PASSWORD FLOW
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        notify('Password reset link sent! Please check your email.', 'success');
        setIsForgotPassword(false);
        setIsLogin(true);
      } else if (isLogin) {
        // LOGIN FLOW
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
           if (error.message.includes("Email not confirmed")) {
             notify('Access Denied: Please verify your email first.', 'error');
             return; 
           }
           throw error;
        }
        notify('Welcome back! Loading your academic dashboard.');
      } else {
        // SIGNUP FLOW
        if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
           throw new Error("Registration restricted to @gmail.com accounts only.");
        }

        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin 
          }
        });
        
        if (error) throw error;

        if (data.user && !data.session) {
           if (data.user.identities && data.user.identities.length === 0) {
              notify('This email is already registered. Please sign in.', 'error');
              setIsLogin(true); 
              return;
           }
           setVerificationSent(true);
           notify('Account created! Please check your inbox.', 'success');
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.message.includes("Error sending confirmation email")) {
         notify("System Busy: Email limit reached. Please try again in 1 hour.", "error");
      } else {
         notify(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Verification Screen (unchanged)
  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white max-w-md w-full p-10 rounded-[2.5rem] shadow-xl text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4">Verify your Email</h2>
          <p className="text-gray-500 font-medium mb-8 leading-relaxed">We've sent a confirmation link to <br/><span className="text-indigo-600 font-bold">{email}</span></p>
          <button onClick={() => { setVerificationSent(false); setIsLogin(true); }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition">Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-stretch bg-white selection:bg-indigo-100">
      {/* Desktop Branding (unchanged) */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 p-16 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-12">
            <div className="bg-white p-2.5 rounded-2xl shadow-xl shadow-indigo-900/20">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <span className="text-3xl font-black text-white tracking-tighter">StudyPro</span>
          </div>
          <h1 className="text-6xl font-black text-white leading-[1.1] mb-6">Master your academic <span className="text-indigo-200">journey.</span></h1>
        </div>
      </div>

      {/* Main Authentication Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 md:bg-white">
        <div className="w-full max-w-md">
          <div className="mb-12">
             <h2 className="text-4xl font-black text-gray-900 mb-3">
                {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Get Started'}
             </h2>
             <p className="text-gray-500 font-medium">
                {isForgotPassword ? 'Enter your email to receive a recovery link.' : isLogin ? 'Login to continue your studies.' : 'Create a new student profile.'}
             </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Student Full Name</label>
                <input type="text" required className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-500 outline-none transition font-bold text-gray-800" placeholder="Username" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
              <input type="email" required className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-500 outline-none transition font-bold text-gray-800" placeholder="e.g:example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password</label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(true); setIsLogin(false); }}
                      className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                    >
                      Forgot your password?
                    </button>
                  )}
                </div>
                <input type="password" required className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-6 py-4 focus:bg-white focus:border-indigo-500 outline-none transition font-bold text-gray-800" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition shadow-2xl shadow-indigo-100 active:scale-[0.98] flex items-center justify-center space-x-3 disabled:opacity-70">
              {loading ? <div className="animate-spin h-5 w-5 border-3 border-white border-t-transparent rounded-full" /> : 
              <span>{isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}</span>}
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-gray-500 font-medium">
              {isForgotPassword ? (
                <button onClick={() => { setIsForgotPassword(false); setIsLogin(true); }} className="text-indigo-600 font-black hover:underline uppercase tracking-tighter text-sm">
                  Back to Login
                </button>
              ) : (
                <>
                  {isLogin ? "New to StudyPro?" : "Already have an account?"}{' '}
                  <button onClick={() => { setIsLogin(!isLogin); setEmail(''); setPassword(''); }} className="text-indigo-600 font-black hover:underline ml-1 uppercase tracking-tighter text-sm">
                    {isLogin ? 'Sign up for free' : 'Log in instead'}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthUI;