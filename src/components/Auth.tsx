import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import Card from './Card';
import Button from './Button';
import Input from './Input';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) alert(error.message);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4">
      <Card className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">SpainTrip 2026</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sign in to start exploring</p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <Input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <Input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          <Button variant="primary" type="submit" disabled={loading} className="mt-4">
            {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
          <span className="text-xs text-gray-400">or</span>
          <span className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
        </div>

        <Button
          variant="neutral"
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          {isSignUp ? 'Sign up with Google' : 'Continue with Google'}
        </Button>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-spanish-orange font-medium hover:underline"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </Card>
    </div>
  );
};

export default Auth;
