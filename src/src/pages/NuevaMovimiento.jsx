// src/pages/NuevaMovimiento.jsx
import React, { useState } from "react";
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  runTransaction
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const NuevaMovimiento = ({ products = [], warehouses = [] }) => {
  const navigate = useNavigate();
  const [movementData, setMovementData] = useState({
    tipoMovimiento: "",
    almacen: "",
  });
  const [currentLine, setCurrentLine] = useState({
    codigoProducto: "",
    nombreProducto: "",
    cantidad: "",
  });
  const [movementItems, setMovementItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [notification, setNotification] = useState({
    message: "",
    type: "",
  });

  const showNotification = (message, type = "error") => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };

  const handleMovementChange = (e) => {
    const { name, value } = e.target;
    setMovementData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (e) => {
    const { name, value } = e.target;
    setCurrentLine((prev) => ({ ...prev, [name]: value }));

    if (name === "nombreProducto") {
      const nameSearch = value.trim().toLowerCase();
      if (nameSearch) {
        const filtered = products.filter((p) =>
          p.nombreProducto.toLowerCase().includes(nameSearch)
        );
        setSuggestions(filtered);
      } else {
        setSuggestions([]);
      }
    }
  };

  const handleCodeBlur = () => {
    const codeSearch = currentLine.codigoProducto.trim().toLowerCase();
    if (codeSearch) {
      const found = products.find(
        (p) => p.codigoProducto.trim().toLowerCase() === codeSearch
      );
      if (found) {
        setCurrentLine((prev) => ({
          ...prev,
          nombreProducto: found.nombreProducto,
        }));
      }
    }
  };

  const handleSelectSuggestion = (product) => {
    setCurrentLine({
      codigoProducto: product.codigoProducto,
      nombreProducto: product.nombreProducto,
      cantidad: currentLine.cantidad,
    });
    setSuggestions([]);
  };

  const handleAddLine = () => {
    const { codigoProducto, nombreProducto, cantidad } = currentLine;
    if (!codigoProducto.trim() || !nombreProducto.trim() || !cantidad) {
      showNotification("Completa código, nombre y cantidad", "error");
      return;
    }
    const qtyNum = Number(cantidad);
    if (isNaN(qtyNum) || qtyNum < 0) {
      showNotification("La cantidad debe ser un número positivo", "error");
      return;
    }
    const productFound = products.find(
      (p) =>
        p.codigoProducto.trim().toLowerCase() ===
        codigoProducto.trim().toLowerCase()
    );
    if (!productFound) {
      showNotification("El producto no existe en la base de datos", "error");
      return;
    }
    setMovementItems((prev) => [
      ...prev,
      {
        codigoProducto: productFound.codigoProducto,
        nombreProducto: productFound.nombreProducto,
        codigoBarras: productFound.codigoBarras || "",
        cantidad: qtyNum,
      },
    ]);
    setCurrentLine({ codigoProducto: "", nombreProducto: "", cantidad: "" });
    setSuggestions([]);
  };

  const totalUnits = movementItems.reduce(
    (acc, item) => acc + Number(item.cantidad),
    0
  );

  const generateLabelsPDF = async (items) => {
    const pdf = new jsPDF({ unit: "mm", format: [50, 25] });
    const labels = [];

    items.forEach((item) => {
      const qty = Number(item.cantidad);
      for (let i = 0; i < qty; i++) {
        labels.push({
          codigo: item.codigoProducto,
          nombre: item.nombreProducto,
          barcode: item.codigoBarras || "",
        });
      }
    });

    const generateBarcodeDataURL = (barcodeText) => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        try {
          JsBarcode(canvas, barcodeText, {
            format: "CODE128",
            displayValue: false,
            height: 25,
          });
          const dataURL = canvas.toDataURL("image/png");
          resolve(dataURL);
        } catch (error) {
          reject(error);
        }
      });
    };

    for (let i = 0; i < labels.length; i++) {
      if (i > 0) pdf.addPage([50, 25]);
      const marginX = 1;
      pdf.setFontSize(8);
      pdf.text(labels[i].codigo, marginX, 3);
      pdf.text(labels[i].nombre, marginX, 7);
      try {
        if (labels[i].barcode) {
          const barcodeDataUrl = await generateBarcodeDataURL(
            labels[i].barcode
          );
          pdf.addImage(
            barcodeDataUrl,
            "PNG",
            marginX,
            9,
            48 - 2 * marginX,
            15
          );
        }
      } catch (err) {
        console.error("Error generando el código de barras:", err);
      }
    }
    pdf.save("etiquetas.pdf");
  };

  // Función para actualizar el stock del producto usando una transacción
  // Se asegura que el stock no baje de 0
  const updateProductStockAtomic = async (productId, warehouseId, cantidad, tipoMovimiento) => {
    try {
      const productDocRef = doc(db, "productos", productId);
      await runTransaction(db, async (transaction) => {
        const prodSnap = await transaction.get(productDocRef);
        if (!prodSnap.exists()) {
          throw new Error("El producto no existe");
        }
        const prodData = prodSnap.data();
        const currentStock = Number(prodData.stocks?.[warehouseId] || 0);
        let newStock;
        if (tipoMovimiento === "Ingreso" || tipoMovimiento === "Recepción de transferencia") {
          newStock = currentStock + Number(cantidad);
        } else if (tipoMovimiento === "Egreso") {
          newStock = currentStock - Number(cantidad);
        } else if (tipoMovimiento === "Ajuste") {
          newStock = Number(cantidad);
        } else {
          throw new Error("Tipo de movimiento desconocido");
        }
        // Evita que el stock sea negativo
        newStock = Math.max(newStock, 0);
        transaction.update(productDocRef, { [`stocks.${warehouseId}`]: newStock });
      });
      console.log(`Stock actualizado para el producto ${productId} en almacén ${warehouseId}`);
    } catch (error) {
      console.error("Error actualizando stock atómico:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!movementData.tipoMovimiento || !movementData.almacen) {
      showNotification("Selecciona un tipo de movimiento y un almacén.", "error");
      return;
    }
    if (movementItems.length === 0) {
      showNotification("Agrega al menos un producto al movimiento.", "error");
      return;
    }

    try {
      const newMovement = {
        fechaMovimiento: new Date().toISOString(),
        tipoMovimiento: movementData.tipoMovimiento,
        almacen: movementData.almacen,
        items: movementItems.map((item) => ({
          codigoProducto: item.codigoProducto,
          nombreProducto: item.nombreProducto,
          cantidad: Number(item.cantidad),
        })),
      };

      // Registra el movimiento en Firestore y obtiene el ID generado
      const docRef = await addDoc(collection(db, "movimientos"), newMovement);
      newMovement.id = docRef.id;

      // Actualizar el stock de cada producto afectado por el movimiento
      for (const item of movementItems) {
        const prod = products.find(
          (p) =>
            String(p.codigoProducto).trim().toLowerCase() ===
            String(item.codigoProducto).trim().toLowerCase()
        );
        if (prod) {
          await updateProductStockAtomic(
            prod.id,
            movementData.almacen,
            item.cantidad,
            movementData.tipoMovimiento
          );
        } else {
          console.error("No se encontró producto para el código:", item.codigoProducto);
        }
      }

      await generateLabelsPDF(movementItems);
      showNotification("Movimiento creado correctamente.", "success");
      navigate("/movimientos");
    } catch (err) {
      console.error("Error al guardar el movimiento:", err);
      showNotification("Hubo un error al crear el movimiento.", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 md:p-6 rounded-lg shadow"
      >
        <h2 className="text-xl md:text-2xl font-bold mb-4">Nuevo Movimiento</h2>
        {notification.message && (
          <div
            className={`mb-4 px-4 py-2 rounded border ${
              notification.type === "error"
                ? "border-red-400 bg-red-100 text-red-700"
                : "border-green-400 bg-green-100 text-green-700"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Datos generales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="tipoMovimiento" className="block text-gray-700 font-medium">
              Tipo de Movimiento
            </label>
            <select
              id="tipoMovimiento"
              name="tipoMovimiento"
              value={movementData.tipoMovimiento}
              onChange={handleMovementChange}
              className="w-full border border-gray-300 rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccione...</option>
              <option value="Ingreso">Ingreso</option>
              <option value="Egreso">Egreso</option>
              <option value="Ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <label htmlFor="almacen" className="block text-gray-700 font-medium">
              Almacén
            </label>
            <select
              id="almacen"
              name="almacen"
              value={movementData.almacen}
              onChange={handleMovementChange}
              className="w-full border border-gray-300 rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccione...</option>
              {warehouses
                .sort((a, b) => {
                  const dateA = a.createdAt?.toDate
                    ? a.createdAt.toDate()
                    : new Date(a.createdAt);
                  const dateB = b.createdAt?.toDate
                    ? b.createdAt.toDate()
                    : new Date(b.createdAt);
                  return dateA - dateB;
                })
                .map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.nombre}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Agregar producto */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Agregar Producto</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <div>
              <label htmlFor="codigoProducto" className="block text-gray-700 text-sm font-medium">
                Código
              </label>
              <input
                type="text"
                id="codigoProducto"
                name="codigoProducto"
                value={currentLine.codigoProducto}
                onChange={handleLineChange}
                onBlur={handleCodeBlur}
                className="w-full border border-gray-300 rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ingresa código..."
              />
            </div>
            <div className="relative">
              <label htmlFor="nombreProducto" className="block text-gray-700 text-sm font-medium">
                Nombre
              </label>
              <input
                type="text"
                id="nombreProducto"
                name="nombreProducto"
                value={currentLine.nombreProducto}
                onChange={handleLineChange}
                className="w-full border border-gray-300 rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ingresa nombre..."
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 bg-white border border-gray-300 rounded mt-1 max-h-32 overflow-y-auto z-10 text-sm">
                  {suggestions.map((prod) => (
                    <li
                      key={prod.id}
                      onMouseDown={() => handleSelectSuggestion(prod)}
                      className="p-1 hover:bg-blue-100 cursor-pointer"
                    >
                      {prod.nombreProducto} ({prod.codigoProducto})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="cantidad" className="block text-gray-700 text-sm font-medium">
                Cantidad
              </label>
              <input
                type="number"
                id="cantidad"
                name="cantidad"
                value={currentLine.cantidad}
                onChange={handleLineChange}
                className="w-full border border-gray-300 rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cantidad..."
                min="0"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={handleAddLine}
                className="w-full bg-green-500 text-white py-1 rounded text-sm hover:bg-green-600 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Lista de productos agregados */}
        {movementItems.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-base mb-2">Productos Agregados</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="py-1 px-2 border border-gray-300">Código</th>
                    <th className="py-1 px-2 border border-gray-300">Producto</th>
                    <th className="py-1 px-2 border border-gray-300">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {movementItems.map((item, index) => (
                    <tr key={index} className="text-center">
                      <td className="py-1 px-2 border border-gray-300">{item.codigoProducto}</td>
                      <td className="py-1 px-2 border border-gray-300">{item.nombreProducto}</td>
                      <td className="py-1 px-2 border border-gray-300">{item.cantidad}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan="2" className="py-1 px-2 border border-gray-300 text-right">
                      Total Unidades:
                    </td>
                    <td className="py-1 px-2 border border-gray-300">{totalUnits}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600 transition-colors"
        >
          Confirmar Movimiento
        </button>
      </form>
    </div>
  );
};

export default NuevaMovimiento;
