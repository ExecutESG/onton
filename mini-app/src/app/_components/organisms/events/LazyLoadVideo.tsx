// LazyLoadVideo.tsx
"use client";
import Image from "next/image";
import React, { useState } from "react";
import { FaSquareCheck } from "react-icons/fa6";
import { useInView } from "react-intersection-observer";
import LoadingIcon from "react-loading";
interface LazyLoadVideoProps {
  src: string;
  hubName: string;
  collectionId: number;
  coverImage: string;
  selected: boolean;
  onClick: () => void;
}

const LazyLoadVideo: React.FC<LazyLoadVideoProps> = ({ src, hubName, collectionId, coverImage, selected, onClick }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 });
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`p-2 rounded-lg cursor-pointer transition-shadow ${selected ? "font-bold" : "font-light"}`}
    >
      <div className="flex items-center justify-center mt-2 space-x-1">
        {selected && <FaSquareCheck />} {/* Icon next to the text */}
        <span>
          {hubName} #{collectionId}
        </span>
      </div>
      {inView ? (
        <video
          src={src}
          poster={coverImage}
          autoPlay
          loop
          muted
          playsInline
          className="w-full bg-gray-600 rounded-lg"
          style={{ pointerEvents: "none" }}
        />
      ) : (
        <div className="w-full bg-gray-200 relative overflow-hidden rounded-lg">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-600">
              <LoadingIcon
                type="spin"
                color="#4A90E2"
                height={60}
                width={60}
              />
            </div>
          )}
          <Image
            src={coverImage}
            alt={`${hubName} cover`}
            fill
            className={`object-cover rounded-lg transition-opacity duration-500 ${isLoading ? "opacity-0" : "opacity-100"}`}
            onLoadingComplete={() => setIsLoading(false)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}
    </div>
  );
};

export default LazyLoadVideo;
