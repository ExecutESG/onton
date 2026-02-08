import { Title } from "@radix-ui/react-toast";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import MainButton from "./atoms/buttons/web-app/MainButton";
interface ModalDialogProps {
  isVisible: boolean;
  onClose: () => void;
  description: string;
  closeButtonText: string;
  icon: string;
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  height: "70vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  transition: "opacity 1.2s ease",
};

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "transparent",
};

const modalStyle: React.CSSProperties = {
  position: "relative",
  backgroundColor: "#18222d",
  height: "100%",
  padding: 0,
  borderTopLeftRadius: "10px",
  borderTopRightRadius: "10px",
  textAlign: "center",
  zIndex: 1001,
  width: "100%",
  maxWidth: "100%",
  transition: "transform 1.2s ease",
};

const contentStyle: React.CSSProperties = {
  marginTop: "10vh",
  marginBottom: "20px",
  textAlign: "center",
  padding: 20,
};

const descriptionStyle: React.CSSProperties = {
  marginBottom: "20px",
  padding: 20,
  fontSize: "16px",
  color: "#fff",
};

const ModalDialog: React.FC<ModalDialogProps> = ({ isVisible, onClose, description, closeButtonText, icon }) => {
  const [show, setShow] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
    } else {
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!show) return null;

  return (
    <div
      style={{
        ...modalOverlayStyle,
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div
        style={backdropStyle}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      ></div>
      <div
        style={{
          ...modalStyle,
          transform: isVisible ? "translateY(0)" : "translateY(100%)",
        }}
      >
        <div style={contentStyle}>
          <Image
            src={icon}
            style={{ margin: "auto" }}
            alt="Icon"
            width={48}
            height={48}
          />
        </div>
        <div style={descriptionStyle}>
          <Title style={{ fontSize: 20 }}>{description}</Title>
        </div>
        {isVisible && show && (
          <MainButton
            onClick={onClose}
            text={closeButtonText}
            color={"primary"}
          />
        )}
      </div>
    </div>
  );
};

export default ModalDialog;
