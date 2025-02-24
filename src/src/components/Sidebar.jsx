import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`fixed top-0 left-0 h-full bg-gradient-to-b from-blue-800 to-indigo-700 text-white shadow-2xl transition-all duration-300 z-50 ${
        isOpen ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="flex flex-col h-full">
        {/* Encabezado */}
        <div className="flex items-center justify-center h-16 border-b border-indigo-500">
          {isOpen ? (
            <span className="text-2xl font-bold">ERP Inventarios</span>
          ) : (
            <span className="text-xl font-bold">ERP</span>
          )}
        </div>

        {/* Menú */}
        <nav className="flex-grow mt-4 space-y-2">
          {/* Productos (ícono que te gustó) */}
          <Link
            to="/productos"
            className="flex items-center gap-4 px-4 py-3 hover:bg-indigo-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3.27 6.96L12 12.01l8.73-5.05"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 22.08V12"
              />
            </svg>
            {isOpen && <span className="text-lg">Productos</span>}
          </Link>

          {/* Movimientos (ícono que te gustó) */}
          <Link
            to="/movimientos"
            className="flex items-center gap-4 px-4 py-3 hover:bg-indigo-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 8h16l-4-4m4 4l-4 4M20 16H4l4 4m-4-4l4-4"
              />
            </svg>
            {isOpen && <span className="text-lg">Movimientos</span>}
          </Link>

          {/* Almacenes (nuevo ícono actualizado) */}
          <Link
            to="/almacenes"
            className="flex items-center gap-4 px-4 py-3 hover:bg-indigo-600 transition-colors"
          >
            {/* Nuevo ícono de edificio */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              stroke="none"
            >
              <path d="M3 21V7l9-4 9 4v14H3z" />
              <path className="text-indigo-300" d="M9 21V13h6v8" />
            </svg>
            {isOpen && <span className="text-lg">Almacenes</span>}
          </Link>

          {/* Rubros (ícono original) */}
          <Link
            to="/rubros"
            className="flex items-center gap-4 px-4 py-3 hover:bg-indigo-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-3-3v6m-7 3h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {isOpen && <span className="text-lg">Rubros</span>}
          </Link>

          {/* Transferencias (ícono anterior sin cambios) */}
          <Link
            to="/transferencias"
            className="flex items-center gap-4 px-4 py-3 hover:bg-indigo-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m0 4H4m4 0l-4 4m12-4h4m-4 0v4m0-4l4 4m-4 5v4m0-4h4m-4 0l4-4M8 16H4m4 0v4m0-4l-4-4"
              />
            </svg>
            {isOpen && <span className="text-lg">Transferencias</span>}
          </Link>

          {/* Compras (ícono original) */}
          <Link
            to="/compras"
            className="flex items-center gap-4 px-4 py-3 hover:bg-indigo-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 11V3a1 1 0 00-1-1H9a1 1 0 00-1 1v8M5 11h14l-1 9H6l-1-9z"
              />
            </svg>
            {isOpen && <span className="text-lg">Compras</span>}
          </Link>
        </nav>

        {/* Pie */}
        <div className="p-4 border-t border-indigo-500">
          {isOpen && (
            <div className="text-center text-xs">
              &copy; {new Date().getFullYear()} ERP Inventarios
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
