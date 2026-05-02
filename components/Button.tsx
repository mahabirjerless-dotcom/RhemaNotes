import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400',
    secondary: 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 focus:ring-blue-300',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400',
  };

  return (
    <button
      disabled={disabled}
      className={`
        flex items-center justify-center px-6 py-2 rounded-full font-semibold
        transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-4 focus:ring-offset-2
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:shadow-md'}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};
