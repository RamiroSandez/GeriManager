import { useState } from "react";
import { supabase } from "../services/supabase";

export default function CrearPaciente() {

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [obraSocial, setObraSocial] = useState("");

  const guardarPaciente = async () => {

    const { error } = await supabase
      .from("Pacientes")
      .insert([
        {
          Nombre_Completo: nombre,
          dni: dni,
          Obra_social: obraSocial
        }
      ]);

    if (error) {
      console.log(error);
      alert("Error al guardar");
    } else {
      alert("Paciente creado");
    }

  };

  return (
    <div>

      <h2>Crear Paciente</h2>

      <input
        placeholder="Nombre completo"
        onChange={(e) => setNombre(e.target.value)}
      />

      <input
        placeholder="DNI"
        onChange={(e) => setDni(e.target.value)}
      />

      <input
        placeholder="Obra Social"
        onChange={(e) => setObraSocial(e.target.value)}
      />

      <button onClick={guardarPaciente}>
        Guardar
      </button>

    </div>
  );
}