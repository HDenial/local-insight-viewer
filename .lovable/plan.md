# Ajustes no mapa: bússola, card e desfixação

## 1. Bússola real no canto superior direito

Substituir o ícone estático por uma rosa dos ventos desenhada em SVG:

- Círculo com marcações dos pontos cardeais (N, S, L, O) e agulha N/S em duas cores (norte destacado).
- A agulha aponta sempre para o norte do mapa (mapa é north-up), acompanhando qualquer rotação futura.
- Mantém o estilo atual: mesmo tamanho, borda, fundo translúcido com blur e tokens de cor do tema.
- Clicar na bússola continua com o comportamento atual do botão: reenquadrar (fit) o trajeto da missão no mapa.

## 2. Card "Dados nesta posição" sempre dentro do canvas

Hoje a posição é calculada com `min()` em CSS e estoura na base do mapa.

- Medir o tamanho real do card e da área do mapa e posicionar com clamp nos dois eixos.
- Flip horizontal (card à esquerda do ponto quando não cabe à direita) e vertical (acima quando não cabe abaixo), com margem mínima da borda.
- Recalcular ao mudar de ponto, ao mover/zoom no mapa e ao redimensionar a janela.

## 3. Soltar a fixação clicando em qualquer lugar do mapa

- Clique no fundo do mapa (ou em outro elemento que não seja um ponto) desfixa o card.
- Clique em outro ponto passa a fixação para esse ponto.
- Clique no mesmo ponto continua desfixando.

## Detalhes técnicos

- `MapView.tsx`: componente `CompassRose` em SVG usando `currentColor`/tokens; posicionamento do card via `useLayoutEffect` + `ResizeObserver` sobre a seção do mapa e o card.
- `MissionMap.tsx`: handler `map.on("click")` chamando um novo callback `onClearPin`; marcadores já usam `bubblingMouseEvents: false`, então cliques em pontos não disparam o clique do mapa.
- Sem mudanças em dados, CSV ou lógica de servidor.
