import React, { useState, useEffect } from 'react';
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4">
      <Card className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800">SpainTrip 2026</h2>
          <p className="text-gray-500 mt-2">Sign in to start exploring</p>
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
