// src/components/EditCompraForm.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const EditCompraForm = ({ warehouses, productosDisponibles }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [compra, setCompra] = useState(null);

  // Estados para datos generales
  const [numeroPedido, setNumeroPedido] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [guias, setGuias] = useState([]);
  const [guiaInput, setGuiaInput] = useState("");

  // Estados para datos del producto (único producto)
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoTotal, setCostoTotal] = useState("");

  // Estados para datos del reclamo
  const [motivoReclamo, setMotivoReclamo] = useState("");
  const [montoReclamo, setMontoReclamo] = useState("");
  const [estadoReclamo, setEstadoReclamo] = useState("");

  // Estados para información adicional (no editables)
  const [proveedor, setProveedor] = useState("");
  const [nombreProveedor, setNombreProveedor] = useState("");
  const [personalProveedor, setPersonalProveedor] = useState("");
  const [personalDelProveedor, setPersonalDelProveedor] = useState("");
  const [personalCompra, setPersonalCompra] = useState("");
  const [personalDeCompra, setPersonalDeCompra] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  // Campo editable para Observaciones
  const [observaciones, setObservaciones] = useState("");

  // Función para actualizar el comprobante combinando número de pedido y guías
  const actualizarComprobante = (pedido, guiasArray) => {
    const pedidoStr = pedido.trim() !== "" ? pedido.trim() : "";
    const guiasStr = guiasArray.length > 0 ? ", " + guiasArray.join(", ") : "";
    setComprobante(pedidoStr + guiasStr);
  };

  useEffect(() => {
    const fetchCompra = async () => {
      const compraRef = doc(db, "compras", id);
      const compraSnap = await getDoc(compraRef);
      if (compraSnap.exists()) {
        const data = compraSnap.data();
        console.log("Datos de la compra:", data); // Log para ver qué propiedades tiene
        setCompra(data);
        // Usamos el mismo nombre de campo que se guardó durante la importación
        setNumeroPedido(data.numeroPedido || data.comprobante || "");
        setGuias(data.guias || []);
        actualizarComprobante(
          data.numeroPedido || data.comprobante || "",
          data.guias || []
        );
        // Datos del producto
        setCodigo(data.codigo || "");
        setNombre(data.nombre || "");
        setCantidad(data.cantidad || "");
        setCostoTotal(data.costoTotal || "");
        // Datos del reclamo
        setMotivoReclamo(data.motivoReclamo || "");
        setMontoReclamo(data.montoReclamo || "");
        setEstadoReclamo(data.estadoReclamo || "");
        // Información adicional (no editables)
        setProveedor(data.proveedor || "");
        setNombreProveedor(data.nombreProveedor || "");
        setPersonalProveedor(data.personalProveedor || "");
        setPersonalDelProveedor(data.personalDelProveedor || "");
        setPersonalCompra(data.personalCompra || "");
        setPersonalDeCompra(data.personalDeCompra || "");
        setNumeroOperacion(data.numeroOperacion || "");
        // Campo editable
        setObservaciones(data.observaciones || "");
      } else {
        alert("No se encontró la compra.");
        navigate("/compras");
      }
    };

    fetchCompra();
  }, [id, navigate]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (motivoReclamo.trim() !== "" && estadoReclamo === "Sin reclamo") {
      alert(
        "Si se seleccionó un motivo de reclamo, el estado de reclamo no puede ser 'Sin reclamo'."
      );
      return;
    }

    try {
      const compraRef = doc(db, "compras", id);
      const updatedEstado = guias.length > 0 ? "En camino" : compra.estado;
      await updateDoc(compraRef, {
        numeroPedido,
        comprobante,
        guias,
        codigo,
        nombre,
        cantidad,
        costoTotal,
        motivoReclamo,
        montoReclamo,
        estadoReclamo,
        estado: updatedEstado,
        proveedor,
        nombreProveedor,
        personalProveedor,
        personalDelProveedor,
        personalCompra,
        personalDeCompra,
        numeroOperacion,
        observaciones,
      });
      navigate("/compras");
    } catch (err) {
      console.error("Error actualizando compra", err);
      alert("Error al actualizar compra.");
    }
  };

  if (!compra) return <div>Cargando...</div>;

  // Usamos "almacenDestino" (sin tilde) ya que es el nombre guardado
  const almacenObj = warehouses.find((w) => w.id === compra.almacenDestino) || {};

  return (
    <form
      autoComplete="off"
      onSubmit={handleSubmit}
      className="max-w-6xl mx-auto p-6 bg-white shadow rounded"
    >
      <h2 className="text-3xl font-bold mb-6 text-center">Editar Compra</h2>

      {/* Datos de la Compra */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-3">Datos de la Compra</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Fecha</label>
            <input
              type="text"
              value={new Date(compra.fecha).toLocaleString()}
              disabled
              className="border p-1 rounded bg-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Almacén</label>
            <input
              type="text"
              value={almacenObj.nombre || compra.almacenDestino || ""}
              disabled
              className="border p-1 rounded bg-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Cuenta</label>
            <input
              type="text"
              value={compra.cuenta || ""}
              disabled
              className="border p-1 rounded bg-gray-200"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Comprobante</label>
            <input
              type="text"
              value={comprobante}
              disabled
              className="border p-1 rounded bg-gray-200 cursor-not-allowed"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Número de Pedido</label>
            <div className="flex">
              <input
                type="text"
                value={numeroPedido}
                disabled
                className="border p-1 rounded-l flex-1 bg-gray-200"
                placeholder="Número de pedido"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(numeroPedido)}
                className="bg-blue-500 text-white px-3 py-1 rounded-r"
              >
                Copiar
              </button>
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Agregar Guía</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="guiaInput"
                autoComplete="off"
                value={guiaInput}
                onChange={(e) => setGuiaInput(e.target.value)}
                className="border p-2 rounded"
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
          <div className="mt-4">
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
        {/* Información Adicional */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Proveedor</label>
            <input
              type="text"
              value={proveedor}
              disabled
              className="border p-2 rounded bg-gray-200"
              placeholder="Proveedor"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Personal Proveedor</label>
            <input
              type="text"
              value={personalProveedor}
              disabled
              className="border p-2 rounded bg-gray-200"
              placeholder="Personal Proveedor"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Personal Compra</label>
            <input
              type="text"
              value={personalCompra}
              disabled
              className="border p-2 rounded bg-gray-200"
              placeholder="Personal Compra"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold"># de Operación</label>
            <input
              type="text"
              value={numeroOperacion}
              disabled
              className="border p-2 rounded bg-gray-200"
              placeholder="# de Operación"
            />
          </div>
          <div className="flex flex-col col-span-4">
            <label className="text-sm font-semibold">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="border p-2 rounded w-full"
              placeholder="Observaciones"
            />
          </div>
        </div>
      </section>

      {/* Datos del Producto */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Datos del Producto</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium">Código</label>
            <input
              type="text"
              value={codigo}
              disabled
              className="border p-2 rounded bg-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">Nombre</label>
            <input
              type="text"
              value={nombre}
              disabled
              className="border p-2 rounded bg-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">Cantidad</label>
            <input
              type="number"
              value={cantidad}
              disabled
              className="border p-2 rounded bg-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">Costo Total</label>
            <input
              type="number"
              value={costoTotal}
              disabled
              className="border p-2 rounded bg-gray-200"
            />
          </div>
        </div>
      </section>

      {/* Datos del Reclamo */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Datos del Reclamo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Motivo de Reclamo</label>
            <select
              value={motivoReclamo}
              onChange={(e) => setMotivoReclamo(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="">Seleccione un motivo</option>
              <option value="Pago rechazado">Pago rechazado</option>
              <option value="Sin envío">Sin envío</option>
              <option value="No entregado">No entregado</option>
              <option value="Entrega incompleta">Entrega incompleta</option>
              <option value="Plazo vencido">Plazo vencido</option>
              <option value="Producto distinto">Producto distinto</option>
              <option value="Producto dañado">Producto dañado</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Monto de Reclamo</label>
            <input
              type="number"
              value={montoReclamo}
              onChange={(e) => setMontoReclamo(e.target.value)}
              className="border p-2 rounded"
              placeholder="Monto de reclamo"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold">Estado de Reclamo</label>
            <select
              value={estadoReclamo}
              onChange={(e) => setEstadoReclamo(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="Sin reclamo">Sin reclamo</option>
              <option value="En curso">En curso</option>
              <option value="Reembolsado">Reembolsado</option>
            </select>
          </div>
        </div>
      </section>

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 transition"
      >
        Actualizar Compra
      </button>
    </form>
  );
};

export default EditCompraForm;
