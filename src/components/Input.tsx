import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  return (
    <input 
      className={`
        bg-spanish-bg rounded-full px-6 py-3
        shadow-neu-pressed outline-none text-gray-700 dark:text-gray-200
        placeholder:text-gray-400 dark:placeholder:text-gray-500
        transition-all duration-200
        focus:shadow-neu-flat
        ${className}
      `}
      {...props}
    />
  );
};

export default Input;
