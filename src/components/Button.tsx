import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'neutral';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'neutral', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "rounded-full transition-all duration-200 ease-in-out active:shadow-neu-pressed flex items-center justify-center font-medium";
  
  const variants = {
    primary: "bg-spanish-orange text-white shadow-neu-flat",
    secondary: "bg-spanish-red text-white shadow-neu-flat",
    neutral: "bg-spanish-bg text-gray-700 shadow-neu-flat"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
    icon: "p-4"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
