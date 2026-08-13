import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — Dice Battle",
  description: "Política de privacidad de Dice Battle.",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-sm prose-invert max-w-none">
      <h1 className="font-heading text-xl font-bold text-white">Política de Privacidad</h1>
      <p className="text-xs text-white/40">Vigente desde: 1 de agosto de 2026</p>

      <Section title="1. Información que recopilamos">
        <p>
          Dice Battle opera principalmente sobre datos públicos de la blockchain de Celo.
          No recopilamos nombre, correo electrónico ni ningún dato de identificación personal
          fuera de la cadena.
        </p>
        <p>Los datos que manejamos incluyen:</p>
        <ul>
          <li>
            <strong>Direcciones de wallet</strong>: públicas por naturaleza; necesarias para
            identificar jugadores, mostrar estadísticas y el leaderboard.
          </li>
          <li>
            <strong>Datos de partidas</strong>: stake, resultado, timestamps — todos provenientes
            de eventos públicos del contrato inteligente, indexados por Goldsky.
          </li>
          <li>
            <strong>Apodos (nicknames)</strong>: si el jugador elige configurar uno, se almacena
            onchain asociado a su dirección.
          </li>
        </ul>
      </Section>

      <Section title="2. Servicios de terceros">
        <ul>
          <li>
            <strong>Goldsky</strong>: indexa los eventos del contrato inteligente (datos
            100 % públicos de la blockchain). No recibe datos privados de los usuarios.
            Consulta su política en{" "}
            <a
              href="https://goldsky.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-celo-yellow hover:underline"
            >
              goldsky.com/privacy
            </a>
            .
          </li>
          <li>
            <strong>Vercel</strong>: plataforma de hosting. Puede registrar logs de acceso
            estándar (IP, user-agent, timestamp). No usamos Vercel Analytics activamente.
            Consulta su política en{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-celo-yellow hover:underline"
            >
              vercel.com/legal/privacy-policy
            </a>
            .
          </li>
          <li>
            <strong>Celo Forno / RPC</strong>: el proveedor RPC que procesa las transacciones
            onchain puede registrar IPs de las solicitudes. Considera usar un RPC privado si
            esto es una preocupación.
          </li>
        </ul>
      </Section>

      <Section title="3. Cookies y almacenamiento local">
        <p>
          Usamos <code>localStorage</code> y cookies exclusivamente para:
        </p>
        <ul>
          <li>Guardar el secreto de la sala (commit) en el dispositivo del creador.</li>
          <li>Mantener la sesión de wallet activa entre visitas (wagmi / Reown AppKit).</li>
          <li>Preferencia de idioma (ES/EN) y preferencia de sonido.</li>
        </ul>
        <p>No usamos cookies de rastreo ni publicidad.</p>
      </Section>

      <Section title="4. Derecho de acceso y portabilidad">
        <p>
          Toda la información de partidas y perfiles está disponible públicamente en la
          blockchain de Celo y en el explorador{" "}
          <a
            href="https://celoscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-celo-yellow hover:underline"
          >
            celoscan.io
          </a>
          . No existe información privada tuya en nuestros servidores que necesites solicitar.
        </p>
      </Section>

      <Section title="5. Retención de datos">
        <p>
          Los datos onchain son permanentes por naturaleza de la blockchain. Los logs de
          servidor de Vercel se retienen según su política (típicamente 30 días).
        </p>
      </Section>

      <Section title="6. Menores de edad">
        <p>
          Dice Battle no está dirigido a personas menores de 18 años. No recopilamos
          intencionalmente información de menores.
        </p>
      </Section>

      <Section title="7. Contacto">
        <p>
          Para consultas sobre privacidad, contáctanos en:{" "}
          <a
            href="https://t.me/dicebattle_support"
            target="_blank"
            rel="noopener noreferrer"
            className="text-celo-yellow hover:underline"
          >
            t.me/dicebattle_support
          </a>
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-heading text-sm font-semibold text-white/80 mb-2">{title}</h2>
      <div className="text-xs text-white/55 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
