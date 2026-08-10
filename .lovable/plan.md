# Mapa dinâmico e rotas de varredura costeira

## Objetivo

Substituir a imagem estática por um mapa OpenStreetMap interativo e corrigir as três missões para que cada uma:

1. comece em um ponto de lançamento na praia/terra;
2. entre diretamente na água;
3. execute uma varredura em zigue-zague distinta;
4. saia da área de varredura e retorne ao mesmo ponto de lançamento;
5. tenha somente o primeiro e o último ponto fora da água.

## Implementação

- Integrar Leaflet com tiles do OpenStreetMap, com pan, zoom, escala e ajuste automático do enquadramento à missão selecionada.
- Isolar o mapa como componente carregado apenas no navegador para manter a renderização do TanStack Start compatível com SSR.
- Desenhar o trajeto com coordenadas geográficas reais, eliminando a projeção fixa atualmente vinculada à imagem de fundo.
- Plotar cada leitura como ponto interativo sobre a rota e manter o comportamento atual:
  - hover mostra “Dados nesta posição” temporariamente;
  - clique fixa o cartão;
  - novo clique no mesmo ponto solta o cartão;
  - sem hover ou ponto fixado, nenhum cartão é exibido.
- Diferenciar visualmente o ponto de lançamento/retorno dos pontos de leitura, sem alterar a estrutura dos dados exibidos.
- Regenerar as coordenadas dos três CSVs com circuitos distintos e reconhecíveis como varreduras tipo “lawnmower”, preservando os demais dados de sensores e a ordem temporal.
- Conferir cada rota sobre o mapa real: primeiro e último ponto na praia, todos os pontos intermediários e todos os segmentos da rota sobre a água.

## Estrutura esperada da rota

```text
praia (início/fim)
       \
        entrada na água ─────────────┐
                                     │
        ┌────────────────────────────┘
        └────────────────────────────┐
        ┌────────────────────────────┘  scan em zigue-zague
        └────────────────────────────┐
                                     │
        saída da área de scan ───────┘
       /
praia (mesmo ponto)
```

## Detalhes técnicos

- Dependências: `leaflet` e tipagens correspondentes.
- Tiles: OpenStreetMap padrão, sem chave de API ou faturamento.
- O mapa ficará em um módulo browser-safe carregado dinamicamente; dados e tipos compartilhados permanecerão fora desse módulo.
- A linha será uma `Polyline` geográfica e os pontos serão marcadores/círculos Leaflet com eventos de mouse e clique.
- O enquadramento será recalculado ao trocar de missão, preservando a seleção pela lista lateral.

## Validação

- Verificar visualmente as três missões no mapa em viewport desktop.
- Confirmar zoom, pan e troca de missão.
- Confirmar que cada scan é distinto, zigue-zague, fechado no mesmo ponto terrestre e não cruza terra entre início e fim.
- Confirmar hover, fixação e soltura do cartão em pontos diferentes da rota.