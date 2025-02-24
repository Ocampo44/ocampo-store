// src/pages/NewProduct.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const NewProduct = ({ rubros }) => {
  const [product, setProduct] = useState({
    codigoProducto: '',
    nombreProducto: '',
    codigoBarras: '',
    idMercadolibre: '',
    rubro: '',
    subRubro: '',
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Si cambia el rubro, reiniciamos el sub rubro
    if (name === 'rubro') {
      setProduct((prev) => ({
        ...prev,
        rubro: value,
        subRubro: '',
      }));
    } else {
      setProduct((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!product.codigoProducto.trim()) {
      alert('El código del producto es requerido');
      return;
    }
    if (!product.nombreProducto.trim()) {
      alert('El nombre del producto es requerido');
      return;
    }
    if (!product.rubro) {
      alert('Debe seleccionar un rubro');
      return;
    }
    if (!product.subRubro) {
      alert('Debe seleccionar un sub rubro');
      return;
    }

    // Inicializamos stocks y transitos como objetos vacíos
    const newProduct = { ...product, stocks: {}, transitos: {} };

    try {
      await addDoc(collection(db, 'productos'), newProduct);
      // Reseteamos el formulario
      setProduct({
        codigoProducto: '',
        nombreProducto: '',
        codigoBarras: '',
        idMercadolibre: '',
        rubro: '',
        subRubro: '',
      });
      // Redirigimos a la lista de productos
      navigate('/productos');
    } catch (error) {
      console.error('Error al guardar el producto en Firestore:', error);
      alert('Hubo un problema al guardar el producto. Inténtalo de nuevo.');
    }
  };

  // Obtenemos la lista de sub rubros disponibles para el rubro seleccionado
  const subRubrosDisponibles =
    product.rubro &&
    rubros.find((r) => String(r.id) === String(product.rubro))
      ? rubros.find((r) => String(r.id) === String(product.rubro)).subRubros
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col items-center py-8 text-black">
      <h1 className="text-4xl font-bold text-black mb-6">Nuevo Producto</h1>
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-xl rounded-lg p-8 w-full max-w-3xl"
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* Código Producto */}
          <div className="w-full md:w-[150px]">
            <label htmlFor="codigoProducto" className="block text-lg font-medium text-black">
              Código Producto
            </label>
            <input
              type="text"
              id="codigoProducto"
              name="codigoProducto"
              value={product.codigoProducto}
              onChange={handleChange}
              placeholder="Código..."
              className="mt-2 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>

          {/* Nombre del Producto */}
          <div className="w-full md:flex-1">
            <label htmlFor="nombreProducto" className="block text-lg font-medium text-black">
              Nombre del Producto
            </label>
            <input
              type="text"
              id="nombreProducto"
              name="nombreProducto"
              value={product.nombreProducto}
              onChange={handleChange}
              placeholder="Nombre del producto..."
              className="mt-2 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>
        </div>

        {/* Resto de campos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="codigoBarras" className="block text-lg font-medium text-black">
              Código de Barras
            </label>
            <input
              type="text"
              id="codigoBarras"
              name="codigoBarras"
              value={product.codigoBarras}
              onChange={handleChange}
              placeholder="Código de barras..."
              className="mt-2 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>
          <div>
            <label htmlFor="idMercadolibre" className="block text-lg font-medium text-black">
              ID Mercadolibre
            </label>
            <input
              type="text"
              id="idMercadolibre"
              name="idMercadolibre"
              value={product.idMercadolibre}
              onChange={handleChange}
              placeholder="ID de Mercadolibre..."
              className="mt-2 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>
        </div>

        {/* Campos para Rubro y Sub Rubro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="rubro" className="block text-lg font-medium text-black">
              Rubro
            </label>
            <select
              id="rubro"
              name="rubro"
              value={product.rubro}
              onChange={handleChange}
              className="mt-2 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            >
              <option value="">Selecciona un rubro</option>
              {rubros.map((rubro) => (
                <option key={rubro.id} value={rubro.id}>
                  {rubro.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="subRubro" className="block text-lg font-medium text-black">
              Sub Rubro
            </label>
            <select
              id="subRubro"
              name="subRubro"
              value={product.subRubro}
              onChange={handleChange}
              disabled={!product.rubro}
              className="mt-2 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            >
              <option value="">Selecciona un sub rubro</option>
              {subRubrosDisponibles.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón Agregar */}
        <div className="mt-6 flex justify-center">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg text-xl transition-colors"
          >
            Agregar Producto
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewProduct;
