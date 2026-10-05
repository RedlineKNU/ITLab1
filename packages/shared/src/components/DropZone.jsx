import React, { useRef, useState } from 'react';

export function DropZone({ onFiles, children }) {
  const [over, setOver] = useState(false);
  const counterRef = useRef(0);

  const handleEnter = (e) => {
    e.preventDefault();
    counterRef.current += 1;
    if (counterRef.current === 1) setOver(true);
  };
  const handleLeave = (e) => {
    e.preventDefault();
    counterRef.current -= 1;
    if (counterRef.current <= 0) {
      counterRef.current = 0;
      setOver(false);
    }
  };
  const handleOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = (e) => {
    e.preventDefault();
    counterRef.current = 0;
    setOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) onFiles?.(files);
  };

  return (
    <div
      className={`dropzone ${over ? 'is-over' : ''}`}
      data-testid="dropzone"
      data-dragging={over ? 'yes' : 'no'}
      onDragEnter={handleEnter}
      onDragLeave={handleLeave}
      onDragOver={handleOver}
      onDrop={handleDrop}
    >
      {over ? <div className="drop-overlay">Відпустіть, щоб завантажити</div> : null}
      {children}
    </div>
  );
}
