import { useState, useRef, useEffect } from "react";
import "./PdfPicker.css";

interface PdfPickerProps {
  availablePdfs: string[];
  selectedPdfs: string[];
  onAdd: (fileId: string) => void;
  onRemove: (fileId: string) => void;
}

export default function PdfPicker({
  availablePdfs,
  selectedPdfs,
  onAdd,
  onRemove,
}: PdfPickerProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? availablePdfs
        .filter((pdf) => !selectedPdfs.includes(pdf))
        .filter((pdf) => pdf.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20)
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="pdf-picker" ref={wrapperRef}>
      <div className="pdf-picker-chips">
        {selectedPdfs.map((pdf) => (
          <span key={pdf} className="pdf-chip">
            {pdf}
            <button
              type="button"
              className="pdf-chip-remove"
              onClick={() => onRemove(pdf)}
              title="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="pdf-picker-input"
        placeholder="Search PDF files..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="pdf-picker-dropdown">
          {filtered.map((pdf) => (
            <li key={pdf}>
              <button
                type="button"
                onClick={() => {
                  onAdd(pdf);
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                {pdf}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
