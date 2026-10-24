import { useRef, useState } from 'react';

export default function FileDrop({ file, onFile, accentLabel }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList) => {
    if (fileList && fileList[0]) onFile(fileList[0]);
  };

  return (
    <div
      className={`filedrop ${dragging ? 'filedrop-active' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {file ? (
        <div className="filedrop-chosen">
          <div className="filedrop-icon">◆</div>
          <div>
            <div className="filedrop-filename">{file.name}</div>
            <div className="filedrop-filesize">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      ) : (
        <>
          <div className="filedrop-icon">↑</div>
          <div className="filedrop-text">
            Click to choose a file, or drag one here
          </div>
          {accentLabel && <div className="filedrop-accent">{accentLabel}</div>}
        </>
      )}
    </div>
  );
}