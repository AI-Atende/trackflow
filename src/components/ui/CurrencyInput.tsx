import React from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  className,
  placeholder,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Remove non-numeric characters
    const numericValue = inputValue.replace(/[^0-9]/g, '');

    // Convert to float (divide by 100 to handle cents)
    const floatValue = parseFloat(numericValue) / 100;

    onChange(isNaN(floatValue) ? 0 : floatValue);
  };

  return (
    <input
      type="text"
      value={value ? formatCurrency(value) : ''}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
};
