"use client";
import { useState, useRef, useEffect } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

type FAQItem = { question: string; answer: string };

export default function Accordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="w-full">
      {items.map((item, i) => (
        <AccordionItem
          key={i}
          id={`faq-${i}`}
          item={item}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </div>
  );
}

function AccordionItem({ item, isOpen, onToggle, id }: { item: FAQItem; isOpen: boolean; onToggle: () => void; id: string }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState('0px');

  useEffect(() => {
    if (!contentRef.current) return;
    setMaxHeight(isOpen ? `${contentRef.current.scrollHeight}px` : '0px');
  }, [isOpen]);

  return (
    <div className="w-full border-b border-muted dark:border-muted/30">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={id}
        className="w-full flex items-center justify-between gap-3 px-0 py-4 bg-transparent dark:bg-transparent transition-colors duration-200"
      >
        <span className="flex-1 text-left text-sm font-semibold text-primary-foreground">{item.question}</span>
        <span className="inline-flex items-center justify-center h-6 w-6 text-primary-foreground transition-colors duration-200" aria-hidden>
          {isOpen ? <LuChevronUp className="h-5 w-5" /> : <LuChevronDown className="h-5 w-5" />}
        </span>
      </button>

      <div id={id} ref={contentRef} style={{ maxHeight }} className="overflow-hidden transition-[max-height] duration-300 ease-in-out px-0">
        <div className="py-4 text-sm text-primary-foreground text-left px-0">{item.answer}</div>
      </div>
    </div>
  );
}
