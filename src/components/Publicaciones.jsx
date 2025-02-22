import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

const Publicaciones = () => {
  const [publicaciones, setPublicaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Suscribirse a la colección de usuarios conectados
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mercadolibreUsers"), (snapshot) => {
      const connectedUsers = snapshot.docs.map((doc) => doc.data());
      setUsuarios(connectedUsers);
    });
    return () => unsub();
  }, []);

  // Para cada usuario, consultar sus publicaciones en Mercado Libre
  useEffect(() => {
    const fetchPublicaciones = async () => {
      const allPublicaciones = [];
      for (const usuario of usuarios) {
        if (usuario.token && usuario.profile && usuario.profile.id) {
          const accessToken = usuario.token.access_token;
          const userId = usuario.profile.id;
          try {
            // Uso de un proxy para evitar el error de CORS
            const proxyUrl = "https://cors-anywhere.herokuapp.com/";
            const targetUrl = `https://api.mercadolibre.com/users/${userId}/items/search?include_filters=true&limit=50&offset=0&access_token=${accessToken}`;
            const response = await fetch(proxyUrl + targetUrl);
            if (response.ok) {
              const data = await response.json();
              // Comprobar que data.results existe antes de acceder a él
              if (data && data.results) {
                allPublicaciones.push({
                  nickname: usuario.profile.nickname || "Sin Nombre",
                  publicaciones: data.results,
                });
              } else {
                console.error("La respuesta no contiene resultados para el usuario:", userId);
                allPublicaciones.push({
                  nickname: usuario.profile.nickname || "Sin Nombre",
                  publicaciones: [],
                });
              }
            } else {
              console.error(`Error al obtener publicaciones para el usuario ${userId}:`, response.status);
              allPublicaciones.push({
                nickname: usuario.profile.nickname || "Sin Nombre",
                publicaciones: [],
              });
            }
          } catch (error) {
            console.error(`Error en la consulta de publicaciones para el vendedor ${userId}:`, error);
            allPublicaciones.push({
              nickname: usuario.profile.nickname || "Sin Nombre",
              publicaciones: [],
            });
          }
        }
      }
      setPublicaciones(allPublicaciones);
    };

    if (usuarios.length > 0) {
      fetchPublicaciones();
    }
  }, [usuarios]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Publicaciones de Usuarios Conectados</h1>
      {publicaciones.length === 0 ? (
        <p>No se encontraron publicaciones.</p>
      ) : (
        publicaciones.map((userPub, index) => (
          <div key={index} style={{ marginBottom: "30px" }}>
            <h2>{userPub.nickname}</h2>
            {userPub.publicaciones.length === 0 ? (
              <p>No hay publicaciones para este usuario.</p>
            ) : (
              <ul>
                {userPub.publicaciones.map((pub) => (
                  <li key={pub.id}>
                    <a href={pub.permalink} target="_blank" rel="noopener noreferrer">
                      {pub.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default Publicaciones;
