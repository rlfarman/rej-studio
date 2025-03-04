'use client'
import { motion } from "framer-motion";

export function Logo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left Strand */}
      <motion.path
        d="M10 2 C16 6, 16 10, 10 14 C4 18, 4 22, 10 26"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
      
      {/* Right Strand */}
      <motion.path
        d="M22 2 C16 6, 16 10, 22 14 C28 18, 28 22, 22 26"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
      
      {/* Connecting Rungs */}
      {[6, 12, 18, 24].map((y, i) => (
        <motion.line
          key={i}
          x1="10"
          y1={y}
          x2="22"
          y2={y}
          stroke="black"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.4, delay: 1 + i * 0.2 }}
        />
      ))}
    </svg>
  );
};

