import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  pressed?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, pressed = false }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        bg-spanish-bg rounded-[24px] p-6 
        ${pressed ? 'shadow-neu-pressed' : 'shadow-neu-flat'}
        transition-all duration-200 ease-in-out
        ${onClick ? 'cursor-pointer active:shadow-neu-pressed' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;
