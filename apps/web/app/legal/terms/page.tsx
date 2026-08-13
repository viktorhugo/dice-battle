import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Uso — Dice Battle",
  description: "Términos y condiciones de uso de Dice Battle.",
};

export default function TermsPage() {
  return (
    <article className="prose prose-sm prose-invert max-w-none">
      <h1 className="font-heading text-xl font-bold text-white">Términos de Uso</h1>
      <p className="text-xs text-white/40">Vigentes desde: 1 de agosto de 2026</p>

      <Section title="1. Descripción del servicio">
        <p>
          Dice Battle es un protocolo de apuestas entre pares (PvP) desplegado en la red Celo
          Mainnet. Los participantes apuestan stablecoins (cUSD, USDT, USDC) en partidas 1v1
          donde el resultado se determina mediante un mecanismo de entropía onchain (commit-reveal
          + <code>block.prevrandao</code>). El ganador recibe el 98 % del pozo total; el 2 %
          restante corresponde a la tarifa del protocolo.
        </p>
        <p>
          Dice Battle es un <strong>protocolo de contratos inteligentes</strong>, no un operador
          de juegos de azar con licencia. Todas las partidas se ejecutan de forma autónoma en la
          blockchain de Celo; ninguna entidad centralizada puede modificar los resultados.
        </p>
      </Section>

      <Section title="2. Elegibilidad">
        <p>
          Al usar Dice Battle declaras que:
        </p>
        <ul>
          <li>Tienes al menos 18 años de edad.</li>
          <li>
            Usas el servicio desde una jurisdicción donde los juegos de azar onchain no están
            prohibidos por ley. Es tu exclusiva responsabilidad verificar la legalidad en tu
            país o región de residencia.
          </li>
          <li>No estás sujeto a sanciones económicas de ninguna jurisdicción.</li>
        </ul>
        <p>
          El servicio <strong>no está disponible</strong> para residentes de jurisdicciones donde
          los juegos de azar en línea están expresamente prohibidos.
        </p>
      </Section>

      <Section title="3. Riesgos y pérdidas">
        <p>
          Las apuestas implican riesgo de pérdida total del monto apostado. Dice Battle no
          garantiza ganancias. El equipo desarrollador no asume responsabilidad alguna por
          pérdidas derivadas del uso del protocolo, incluyendo:
        </p>
        <ul>
          <li>Pérdidas económicas por partidas no ganadas.</li>
          <li>Errores en contratos inteligentes no auditados formalmente.</li>
          <li>Volatilidad o pérdida de valor de los tokens apostados.</li>
          <li>Fallos de red, congestión de la blockchain o interrupciones del servicio.</li>
        </ul>
      </Section>

      <Section title="4. Mecanismo de aleatoriedad">
        <p>
          El resultado de cada partida se determina mediante:
        </p>
        <ol>
          <li>
            <strong>Commit</strong>: el creador de la sala envía un hash de su secreto al
            crear la partida.
          </li>
          <li>
            <strong>Reveal</strong>: al revelar, el contrato usa{" "}
            <code>block.prevrandao</code> (entropía del validador de Celo) y el secreto para
            generar los dados.
          </li>
        </ol>
        <p>
          Este mecanismo es verificable onchain por cualquier persona. Sin embargo,{" "}
          <code>block.prevrandao</code> es provisto por los validadores de Celo y no es
          completamente impredecible por actores con influencia sobre el consenso. El protocolo
          es honesto respecto a esta limitación.
        </p>
      </Section>

      <Section title="5. Tarifa del protocolo">
        <p>
          Una tarifa fija del <strong>2 % del pozo total</strong> se deduce automáticamente al
          momento del settlement. Esta tarifa es no negociable y se recoge en la dirección del
          propietario del contrato.
        </p>
      </Section>

      <Section title="6. Ventana de revelación">
        <p>
          Tras unirse un segundo jugador, el creador de la sala tiene una ventana de tiempo
          configurable (actualmente ~24 horas en bloques de Celo) para revelar su secreto y
          resolver la partida. Si no revela dentro de ese plazo, el oponente puede reclamar el
          pozo completo mediante la función <code>claimExpired</code>.
        </p>
      </Section>

      <Section title="7. Propiedad intelectual">
        <p>
          El código fuente de los contratos inteligentes está publicado de forma abierta. La
          interfaz web, el diseño y los assets gráficos son propiedad del equipo desarrollador.
        </p>
      </Section>

      <Section title="8. Modificaciones">
        <p>
          Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios
          se publicarán en esta misma URL. El uso continuado del servicio tras la publicación de
          cambios implica la aceptación de los términos actualizados.
        </p>
      </Section>

      <Section title="9. Soporte">
        <p>
          Para consultas o soporte, contáctanos en:{" "}
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
