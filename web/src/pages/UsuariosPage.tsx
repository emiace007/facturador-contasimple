import UsuariosPanel from '../components/UsuariosPanel';
import { card } from '../components/Aviso';

/** Pantalla del dueño: los usuarios de su comercio (él y sus empleados). */
export default function UsuariosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Usuarios</h1>
        <p className="text-sm text-slate-500 max-w-prose">Las personas que pueden entrar a facturar por tu comercio. Los empleados ven y cargan lo mismo que vos, pero no pueden agregar usuarios.</p>
      </div>
      <div className={card}>
        <UsuariosPanel esEstudio={false} />
      </div>
    </div>
  );
}
