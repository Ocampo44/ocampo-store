// src/components/AddCompraForm.jsx
import React, { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

const AddCompraForm = ({ warehouses = [], productosDisponibles = [] }) => {
  // Estados de datos principales
  const [numeroPedido, setNumeroPedido] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [almacenDestino, setAlmacenDestino] = useState("");
  const [estado, setEstado] = useState("Pendiente de envío");
  const [cuenta, setCuenta] = useState("");

  // Estados nuevos para inputs adicionales
  const [proveedor, setProveedor] = useState("");
  const [personalProveedor, setPersonalProveedor] = useState("");
  const [personalCompra, setPersonalCompra] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Estados para manejo de guías
  const [guiaInput, setGuiaInput] = useState("");
  const [guias, setGuias] = useState([]);

  // Estados para manejo de productos a agregar
  const [productoCodigo, setProductoCodigo] = useState("");
  const [productoNombre, setProductoNombre] = useState("");
  const [productoCantidad, setProductoCantidad] = useState("");
  const [productoCostoTotal, setProductoCostoTotal] = useState("");
  const [productos, setProductos] = useState([]);

  // Estados para autocomplete en el input de nombre
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Estado para mostrar alertas personalizadas
  const [alerta, setAlerta] = useState({ show: false, message: "", type: "" });

  const navigate = useNavigate();

  // Función para actualizar el comprobante combinando número de pedido y guías
  const actualizarComprobante = (pedido, guiasArray) => {
    const pedidoStr = pedido.trim() !== "" ? pedido.trim() + ", " : "";
    const guiasStr = guiasArray.join(", ");
    setComprobante(pedidoStr + guiasStr);
  };

  const handleNumeroPedidoChange = (e) => {
    const nuevoPedido = e.target.value;
    setNumeroPedido(nuevoPedido);
    actualizarComprobante(nuevoPedido, guias);
  };

  const handleAddGuia = () => {
    if (guiaInput.trim() === "") return;
    const nuevaGuia = guiaInput.trim();
    const updatedGuias = [...guias, nuevaGuia];
    setGuias(updatedGuias);
    actualizarComprobante(numeroPedido, updatedGuias);
    setGuiaInput("");
  };

  const handleDeleteGuia = (index) => {
    const updatedGuias = guias.filter((_, i) => i !== index);
    setGuias(updatedGuias);
    actualizarComprobante(numeroPedido, updatedGuias);
  };

  // Eliminar un producto de la lista
  const handleDeleteProducto = (index) => {
    const updatedProductos = productos.filter((_, i) => i !== index);
    setProductos(updatedProductos);
  };

  // Manejo de los inputs de producto
  const handleCodigoChange = (e) => {
    const value = e.target.value;
    setProductoCodigo(value);
    const prod = productosDisponibles.find(
      (p) =>
        p.codigoProducto.toLowerCase() === value.toLowerCase() ||
        (p.codigoBarras && p.codigoBarras.toLowerCase() === value.toLowerCase())
    );
    if (prod) {
      setProductoNombre(prod.nombreProducto);
      setSugerencias([]);
      setMostrarSugerencias(false);
    }
  };

  const handleNombreChange = (e) => {
    const value = e.target.value;
    setProductoNombre(value);
    if (value.trim() === "") {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    const filtrados = productosDisponibles.filter((p) =>
      p.nombreProducto.toLowerCase().includes(value.toLowerCase())
    );
    setSugerencias(filtrados);
    setMostrarSugerencias(true);

    const prodExacto = productosDisponibles.find(
      (p) => p.nombreProducto.toLowerCase() === value.toLowerCase()
    );
    if (prodExacto) {
      setProductoCodigo(prodExacto.codigoProducto);
    }
  };

  const handleSeleccionarSugerencia = (prod) => {
    setProductoNombre(prod.nombreProducto);
    setProductoCodigo(prod.codigoProducto);
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  // Al agregar el producto se toma el costo total ingresado
  const handleAddProducto = () => {
    if (
      productoCodigo.trim() === "" ||
      productoNombre.trim() === "" ||
      productoCantidad === "" ||
      productoCostoTotal === ""
    )
      return;

    const nuevoProducto = {
      codigo: productoCodigo,
      nombre: productoNombre,
      cantidad: productoCantidad,
      costoTotal: productoCostoTotal,
    };
    setProductos([...productos, nuevoProducto]);
    // Reiniciamos los campos
    setProductoCodigo("");
    setProductoNombre("");
    setProductoCantidad("");
    setProductoCostoTotal("");
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validaciones básicas
    if (numeroPedido.trim() === "") {
      setAlerta({
        show: true,
        message: "Por favor, ingrese el Número de Pedido.",
        type: "error",
      });
      return;
    }
    if (almacenDestino.trim() === "") {
      setAlerta({
        show: true,
        message: "Por favor, seleccione un depósito (Almacén Destino).",
        type: "error",
      });
      return;
    }
    if (productos.length === 0) {
      setAlerta({
        show: true,
        message: "Debe agregar al menos un producto a la compra.",
        type: "error",
      });
      return;
    }

    // Si hay al menos una guía, se establece el estado "En camino"
    const compraEstado = guias.length > 0 ? "En camino" : estado;

    // Datos comunes de la compra, incluyendo estadoReclamo como "Sin reclamo"
    const baseCompra = {
      numeroPedido,
      comprobante,
      almacenDestino,
      estado: compraEstado,
      cuenta,
      guias,
      estadoReclamo: "Sin reclamo",
      fecha: new Date().toISOString(),
      // Campos adicionales
      proveedor,
      personalProveedor,
      personalCompra,
      numeroOperacion,
      observaciones,
    };

    try {
      // Se crea un documento en "compras" por cada producto
      for (const producto of productos) {
        await addDoc(collection(db, "compras"), {
          ...baseCompra,
          codigo: producto.codigo,
          nombre: producto.nombre,
          cantidad: producto.cantidad,
          costoTotal: producto.costoTotal,
        });
      }
      setAlerta({
        show: true,
        message: "Compra guardada exitosamente.",
        type: "success",
      });
      // Reiniciar estados
      setNumeroPedido("");
      setComprobante("");
      setAlmacenDestino("");
      setEstado("Pendiente de envío");
      setCuenta("");
      setProveedor("");
      setPersonalProveedor("");
      setPersonalCompra("");
      setNumeroOperacion("");
      setObservaciones("");
      setGuiaInput("");
      setGuias([]);
      setProductos([]);
    } catch (error) {
      console.error("Error al guardar la compra:", error);
      setAlerta({
        show: true,
        message: "Error al guardar la compra en la base de datos.",
        type: "error",
      });
    }
  };

  return (
    <div className="relative">
      {alerta.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black opacity-40"></div>
          <div className="relative p-6 rounded-lg shadow-2xl border max-w-sm w-full bg-white">
            <h3 className="text-xl font-bold mb-2">
              {alerta.type === "error" ? "Error" : "Éxito"}
            </h3>
            <p className="mb-4">{alerta.message}</p>
            <button
              onClick={() => {
                setAlerta({ ...alerta, show: false });
                if (alerta.type === "success") navigate("/compras");
              }}
              className="w-full py-2 bg-blue-600 text-white rounded"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="p-4 w-full bg-white shadow rounded">
        <h2 className="text-2xl font-bold mb-4">Agregar Nueva Compra</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Comprobante</label>
            <input
              type="text"
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              className="w-full border p-2 rounded bg-gray-200 cursor-not-allowed"
              placeholder="Se construye automáticamente"
              disabled
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Almacén Destino</label>
            <select
              value={almacenDestino}
              onChange={(e) => setAlmacenDestino(e.target.value)}
              className="w-full border p-2 rounded"
            >
              <option value="">Seleccione un depósito</option>
              {warehouses.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full border p-2 rounded"
            >
              <option value="Pendiente de envío">Pendiente de envío</option>
              <option value="En camino">En camino</option>
              <option value="Recepcionado parcialmente">
                Recepcionado parcialmente
              </option>
              <option value="Recepcionado">Recepcionado</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Cuenta</label>
            <input
              type="text"
              value={cuenta}
              onChange={(e) => setCuenta(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Cuenta asociada"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Número de Pedido</label>
            <input
              type="text"
              value={numeroPedido}
              onChange={handleNumeroPedidoChange}
              className="w-full border p-2 rounded"
              placeholder="Número de pedido"
            />
          </div>
        </div>
        {/* Inputs adicionales */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Proveedor</label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Nombre del proveedor"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Personal Proveedor</label>
            <input
              type="text"
              value={personalProveedor}
              onChange={(e) => setPersonalProveedor(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Nombre del personal del proveedor"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Personal Compra</label>
            <input
              type="text"
              value={personalCompra}
              onChange={(e) => setPersonalCompra(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Nombre del personal de compra"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1"># de Operación</label>
            <input
              type="text"
              value={numeroOperacion}
              onChange={(e) => setNumeroOperacion(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Número de operación"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Observaciones adicionales"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold mb-1">Agregar Guía</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={guiaInput}
                onChange={(e) => setGuiaInput(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="Número de guía"
              />
              <button
                type="button"
                onClick={handleAddGuia}
                className="bg-green-500 text-white px-3 py-2 rounded"
              >
                +
              </button>
            </div>
          </div>
        </div>
        {guias.length > 0 && (
          <div className="mb-4">
            <span className="font-semibold block mb-2">Guías registradas:</span>
            <div className="flex flex-wrap gap-4">
              {guias.map((guia, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-gray-100 p-2 rounded"
                >
                  <span>{guia}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteGuia(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mb-4 relative">
          <h3 className="text-xl font-semibold mb-2">Agregar Producto</h3>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold mb-1">Código</label>
                <input
                  type="text"
                  value={productoCodigo}
                  onChange={handleCodigoChange}
                  className="w-full border p-2 rounded"
                  placeholder="Código del producto o de barras"
                />
              </div>
              <div className="flex-1 relative">
                <label className="block text-sm font-semibold mb-1">Nombre</label>
                <input
                  type="text"
                  value={productoNombre}
                  onChange={handleNombreChange}
                  onFocus={() => {
                    if (productoNombre.trim() !== "" && sugerencias.length > 0)
                      setMostrarSugerencias(true);
                  }}
                  onBlur={() =>
                    setTimeout(() => setMostrarSugerencias(false), 100)
                  }
                  className="w-full border p-2 rounded"
                  placeholder="Nombre del producto"
                />
                {mostrarSugerencias && sugerencias.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 max-h-48 overflow-auto">
                    {sugerencias.map((prod) => (
                      <li
                        key={prod.id}
                        onClick={() => handleSeleccionarSugerencia(prod)}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {prod.nombreProducto} ({prod.codigoProducto})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold mb-1">Cantidad</label>
                <input
                  type="number"
                  value={productoCantidad}
                  onChange={(e) => setProductoCantidad(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="Cantidad"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold mb-1">Costo Total</label>
                <input
                  type="number"
                  value={productoCostoTotal}
                  onChange={(e) => setProductoCostoTotal(e.target.value)}
                  className="w-full border p-2 rounded"
                  placeholder="Costo total"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddProducto}
                  className="bg-green-500 text-white px-4 py-2 rounded whitespace-nowrap"
                >
                  Agregar Producto +
                </button>
              </div>
            </div>
          </div>
        </div>
        {productos.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Productos Agregados</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border px-4 py-2">Código</th>
                    <th className="border px-4 py-2">Nombre</th>
                    <th className="border px-4 py-2">Cantidad</th>
                    <th className="border px-4 py-2">Costo Total</th>
                    <th className="border px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((prod, index) => (
                    <tr key={index}>
                      <td className="border px-4 py-2">{prod.codigo}</td>
                      <td className="border px-4 py-2">{prod.nombre}</td>
                      <td className="border px-4 py-2">{prod.cantidad}</td>
                      <td className="border px-4 py-2">{prod.costoTotal}</td>
                      <td className="border px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteProducto(index)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            Guardar Compra
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCompraForm;
