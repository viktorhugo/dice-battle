# Branching Strategy

## Ramas y sus triggers de deploy

| Rama | Deploy automático | Propósito |
|---|---|---|
| `master` | Vercel (web en producción) | Código production-ready |
| `envio` | Envio hosted (indexer) | Cambios al indexer |
| `feature/xxx` | Ninguno | Trabajo nuevo |

## Flujo de trabajo

### Nueva feature
```bash
git checkout -b feature/nombre-feature
# ... trabajas y commiteas ...
git push origin feature/nombre-feature
# → abrir PR a master → merge → Vercel redeploya automáticamente
```

### Cambio en el indexer (config.yaml, schema, handlers)
```bash
git checkout envio
git merge master           # o cherry-pick el commit específico
git push origin envio      # → Envio redespliega
```

## Por qué no `develop`

- Añade un paso extra sin beneficio real si no hay entorno de staging
- Para un equipo pequeño, `feature/xxx → master` es suficiente
- El staging se puede verificar localmente antes de mergear

## Regla clave

Separar los triggers de deploy por rama evita que un push a `master`
redespliege servicios que no cambiaron (ej. el indexer).
