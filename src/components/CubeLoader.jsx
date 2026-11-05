import React from 'react';
import './CubeLoader.css';

const CubeLoader = ({ message = 'Cargando auditoría...' }) => {
  return (
    <div className="audit-loader-overlay" role="status" aria-live="polite">
      <div className="cube-wrapper">
        <div className="cube-folding">
          <span className="leaf1"></span>
          <span className="leaf2"></span>
          <span className="leaf3"></span>
          <span className="leaf4"></span>
        </div>
        <span className="loading-label">{message}</span>
      </div>
    </div>
  );
};

export default CubeLoader;

