import React, { useState, useEffect } from 'react';

interface DecimalInputProps {
  value: number | string;
  onChange: (val: number) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function DecimalInput({
  value,
  onChange,
  max = 10,
  disabled,
  className,
  placeholder
}: DecimalInputProps) {
  const [tempValue, setTempValue] = useState<string>('');

  useEffect(() => {
    // Sync external value changes
    if (value === undefined || value === null || value === '') {
      setTempValue('');
    } else {
      // Convert period to comma for display to align with Brazilian format
      setTempValue(String(value).replace('.', ','));
    }
  }, [value]);

  const handleChange = (valStr: string) => {
    // Only allow digits, one comma or dot
    const cleanStr = valStr.replace(/[^0-9.,]/g, '');
    setTempValue(cleanStr);

    const parsed = parseFloat(cleanStr.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (!tempValue) {
      onChange(0);
      setTempValue('');
      return;
    }

    let parsed = parseFloat(tempValue.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      parsed = 0;
    } else if (parsed > max) {
      parsed = max;
    }
    
    onChange(parsed);
    setTempValue(String(parsed).replace('.', ','));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      value={tempValue}
      onChange={e => handleChange(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
    />
  );
}
