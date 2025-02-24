// src/pages/EditProduct.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Firestore
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const EditProduct = ({ rubros = [] }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Estado local para guardar el producto que se edita
  const [product, setProduct] = useState({
    codigoProducto: '',
    nombreProducto: '',
    codigoBarras: '',
    idMercadolibre: '',
    stock: 0,
    rubro: '',
    subRubro: '',
  });

  // Estado para indicar si el producto existe o no en Firestore
  const [notFound, setNotFound] = useState(false);

  // 1) Al montar, cargar el producto de Firestore
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'productos', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Si existe, llenamos el estado con el contenido del documento
          setProduct({
            // Podemos meter docSnap.id si necesitamos
            ...docSnap.data(),
          });
        } else {
          // Si no existe, marcamos "notFound"
          setNotFound(true);
        }
      } catch (error) {
        console.error('Error obteniendo el producto de Firestore:', error);
        setNotFound(true);
      }
    };
    fetchProduct();
  }, [id]);

  // 2) Manejadores de formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Si se cambia el rubro, reiniciamos el sub rubro
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

  // 3) Al enviar, validar y actualizar en Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones mínimas
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

    try {
      // Referencia al documento que vamos a actualizar
      const docRef = doc(db, 'productos', id);
      // Actualizar en Firestore con updateDoc
      await updateDoc(docRef, {
        codigoProducto: product.codigoProducto,
        nombreProducto: product.nombreProducto,
        codigoBarras: product.codigoBarras,
        idMercadolibre: product.idMercadolibre,
        stock: Number(product.stock) || 0, // convertir a número
        rubro: product.rubro,
        subRubro: product.subRubro,
      });

      // Luego, redirigimos a la lista
      navigate('/productos');
    } catch (error) {
      console.error('Error actualizando el producto en Firestore:', error);
      alert('Hubo un problema al actualizar el producto. Inténtalo de nuevo.');
    }
  };

  // 4) Calcular subRubros disponibles según el rubro seleccionado
  const subRubrosDisponibles =
    product.rubro &&
    rubros.find((r) => String(r.id) === String(product.rubro))
      ? rubros.find((r) => String(r.id) === String(product.rubro)).subRubros
      : [];

  // 5) Si no existe el producto, mostramos mensaje
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center text-black">
        <p>Producto no encontrado.</p>
      </div>
    );
  }

  // 6) Si se está cargando (producto vacío) podemos poner un loading...
  //    Pero aquí asumimos que si no notFound y product está en default,
  //    es porque sigue en proceso de cargar. Puedes añadir un spinner si gustas.
  //    Por simplicidad, mostramos el formulario aunque esté vacío (hasta que se llene).

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-50 flex flex-col items-center py-8 text-black">
      <h1 className="text-4xl font-bold text-black mb-6">Editar Producto</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-lg p-8 w-full max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Código Producto */}
          <div>
            <label htmlFor="codigoProducto" className="block text-lg font-medium text-black">
              Código Producto
            </label>
            <input
              type="text"
              id="codigoProducto"
              name="codigoProducto"
              value={product.codigoProducto}
              onChange={handleChange}
              placeholder="Ingrese el código"
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>

          {/* Nombre del Producto */}
          <div>
            <label htmlFor="nombreProducto" className="block text-lg font-medium text-black">
              Nombre del Producto
            </label>
            <input
              type="text"
              id="nombreProducto"
              name="nombreProducto"
              value={product.nombreProducto}
              onChange={handleChange}
              placeholder="Ingrese el nombre del producto"
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>

          {/* Código de Barras */}
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
              placeholder="Ingrese el código de barras"
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>

          {/* ID Mercadolibre */}
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
              placeholder="Ingrese el ID de Mercadolibre"
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>

          {/* Stock */}
          <div>
            <label htmlFor="stock" className="block text-lg font-medium text-black">
              Stock
            </label>
            <input
              type="number"
              id="stock"
              name="stock"
              value={product.stock}
              onChange={handleChange}
              placeholder="Ingrese el stock"
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            />
          </div>

          {/* Rubro */}
          <div>
            <label htmlFor="rubro" className="block text-lg font-medium text-black">
              Rubro
            </label>
            <select
              id="rubro"
              name="rubro"
              value={product.rubro}
              onChange={handleChange}
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
            >
              <option value="">Selecciona un rubro</option>
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Rubro */}
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
              className="mt-2 w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 text-black"
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

        <div className="mt-8 flex justify-center">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg text-xl transition-colors"
          >
            Actualizar Producto
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProduct;
