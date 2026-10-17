# ASCII World

Action RPG en tiempo real en un mundo medieval dibujado solo con caracteres de texto, inspirado en el estilo de [@ansenjeo](https://www.instagram.com/ansenjeo/): miles de caracteres diminutos de colores, iluminación dinámica y resplandor (bloom).

## Cómo jugar

Necesita un servidor local (WebGL + varios scripts):

```bash
python -m http.server 8123
```

y abre http://localhost:8123

## Controles

| Tecla | Acción |
|---|---|
| WASD / flechas | Moverse |
| Espacio / clic | Atacar con la espada |
| Clic (en la muralla) | Disparar flecha de fuego hacia el ratón |
| Shift | Esquivar (rodar, invulnerable un instante) |
| E | Hablar, comprar, cosechar, plantar, subir/bajar escaleras y la muralla |
| R | Comer (primero carne, si tienes; si no, una patata) |
| Q | Beber poción |
| M | Mapa de todo el reino (o de las catacumbas) |
| F | Beber una poción de fuego |
| N | Activar o silenciar la música |
| V | Activar o silenciar los efectos de sonido |
| G | Guardar partida (también se guarda sola cada 2 minutos) |
| C (en el título) | Continuar la partida guardada |
| + / - | Zoom (tamaño de los caracteres) |

## La intro

Al empezar una partida nueva, una intro sobrevuela el reino y cuenta su historia (la fundación, la edad dorada, la codicia de los mineros, el despertar del dragón Ignaroth, sus siervos y la Araña Gigante). ESPACIO pasa de escena y ESC la salta.

## La misión

1. Habla con el **rey** en el salón del trono: un dragón asola el reino, pero sus escamas no se pueden atravesar con espadas normales.
2. Baja a las **catacumbas** y mata a la **Araña Gigante** en su nido (en mitad de la vía más larga del tren). Te quedas su **colmillo venenoso**.
3. Llévaselo al **herrero** del castillo: forja la **Espada Matadragones** (hoja verdosa).
4. Mata al **dragón** en su guarida. Sin esa espada tus golpes rebotan en sus escamas (solo un 15 % del daño); con ella hacen un 50 % más.
5. Vuelve al rey.

**Misiones secundarias**

- **La bruja Morgana** vive en una cabaña abandonada en lo hondo de un bosque. Vende pociones de curación baratas y, si le llevas **2 setas luminosas** (brillan de noche en los bosques; se recogen con E), te prepara una **poción de fuego** (F): 90 segundos en que el fuego del dragón apenas te daña.
- **El Gólem del Roble** duerme junto a un **árbol centenario**. Despierta si te acercas; si lo vences, lleva su **corazón** a la bruja y te hará el **Elixir del Roble**: +25 de vida máxima y resistencia permanente al fuego.

## En el móvil

En pantallas táctiles aparecen controles propios (se fuerzan con `?tactil` en la dirección):

- **Joystick** abajo a la izquierda para moverte (8 direcciones).
- **Botones** abajo a la derecha: ⚔ atacar, **E** usar/hablar, **»** esquivar y 🎒 **mochila**, que despliega poción, comer, poción de fuego y mapa.
- **⚙ Opciones** (arriba): acercar/alejar, guardar, pantalla completa (en Android también fija el modo horizontal) y música.
- **Tocar la pantalla**: en las torretas, la muralla o el vagón, dispara hacia donde tocas; en diálogos, mapa, intro y pantallas de fin, avanza.
- **Pellizcar** con dos dedos para acercar o alejar.
- En vertical aparece un aviso para girar el móvil.

## El mundo

El reino es **siempre el mismo** (semilla fija `20261012` en `js/main.js`). Para probar otro mapa, abre el juego con `?semilla=123` en la dirección. Villa Real y Altamira están en extremos opuestos y unidas por una línea directa del tren; la guarida del dragón queda lejos de ambas y sin tren cerca: hay que ir a pie.

- **Castillo de Valcorona**: una gran fortaleza con doble muralla, torres, foso y puente, torre del homenaje con el salón del trono y un patio con herrería, armería y jardines. El rey te da la misión; el herrero mejora tu espada y el armero tu armadura.
- **Un reino enorme** (600×380 casillas) con 12 aldeas, ríos, bosques y cordilleras.
- **Altamira**, una gran ciudad amurallada con cuatro puertas, plaza mayor con mercado y fuentes, catedral con campanario y vidrieras, ayuntamiento, posada, torres de piedra, barrios de casas alemanas de entramado y molinos de viento en las afueras.
- **Torres de madera para arqueros** en Altamira y algunas aldeas: sube por la escalera de mano (E) y dispara con el ratón.
- **Catacumbas** bajo el mapa que unen Villa Real, Altamira y varias aldeas: túneles a la luz de las antorchas, criptas con sarcófagos y tesoros, ratas, arañas, esqueletos y el nido de la araña gigante. Se entra por las escaleras (E) de las plazas.
- **Partidas guardadas** en el navegador: G para guardar, guardado automático, y C en el título para continuar.
- **La muralla**: sube por las escalinatas junto al palacio (E), coge un arco del soporte y dispara flechas de fuego con el ratón. Vuelan lejos en parábola, hacen más daño que la espada y queman al enemigo.
- **Villa Real**, la ciudad al pie del castillo: plaza del mercado, la Posada del Dragón Dormido (estofado: comida y vida), casas y huertos con el granjero.
- **Aldeas** con aldeanos, una curandera y su huerto.
- **Casas con interior**: desde fuera ves el tejado (con chimeneas que echan humo); al entrar desaparece y ves los muebles, y el exterior se apaga. Algunas tienen **segundo piso** (escaleras + E) con cofres.
- **Huertos y hambre**: tu barra de comida baja con el tiempo y, con hambre, la vida se escapa poco a poco. Cosecha patatas maduras con E, cómelas con R y planta semillas en la tierra vacía (crecen más rápido con lluvia).
- **Agua**: color según la profundidad (turquesa en la orilla, azul intenso mar adentro), vaivén lento, espuma que va y viene, destellos del sol y gotas de lluvia. Los **lagos** del interior se pueden vadear (más despacio, salpicando); el océano, los ríos y el foso del castillo no.
- **Hierba y árboles**: la hierba se mece en matojos sueltos y se aparta a tu paso; hay matas de hierba alta que te tapan las piernas y se doblan y sacuden cuando las cruzas; los árboles tienen tamaños variados (arbolillos, adultos y algún gigante) y sus ramas se agitan, con hojas que caen, cuando pasas rozándolos.
- **Charcos**: unos 240, sobre todo en caminos y prados del campo (pocos en los pueblos), de formas irregulares y tres tamaños, con alguna charca grande. Reflejan el cielo y al caballero, y al pisarlos salpican con gotas que rebotan y ondas que se abren.
- **Vistas de frente y de espaldas**: al moverte hacia abajo ves la cara del caballero; hacia arriba, su espalda y la capa. También el caballo, los aldeanos y los enemigos humanoides.
- **Bichos del bosque**: escarabajos, cucarachas, hormigas y ciempiés que corretean entre la hojarasca y se dispersan en desbandada al acercarte.
- **Luz y atmósfera**: sombras de nubes que se deslizan de día, rayos de sol entre las copas del bosque, haces de luz al amanecer y al atardecer, neblina del alba, bruma con la lluvia, polillas alrededor de los farolillos y una viñeta suave (azulada de noche).
- **La noche**: farolillos de papel de colores que iluminan el suelo al subir y acaban titilando como estrellas; murciélagos que revolotean (y rondan tu antorcha, también en las catacumbas); fuegos fatuos en cementerios y bosques; setas luminiscentes; destellos de luna en el agua; y ventanas encendidas que derraman luz en las calles (algunas se apagan de madrugada).
- **Asedios**: cada 5–8 minutos suena la campana y una horda sale del bosque más cercano, uno tras otro, (goblins, orcos y bandidos con antorchas y un Caudillo orco) asedia una aldea o los arrabales de una ciudad. Cruzan las zonas seguras (solo lo que está intramuros del castillo, Villa Real y Altamira es impenetrable) siguiendo rutas hasta las puertas y rodean el pueblo y, unos 2 minutos y medio después de la campana, prenden fuego casa por casa: llamas en tejados y ventanas, humo negro, pavesas, resplandor y derrumbes. Si arde más de la mitad, el pueblo cae y tarda 3 días en reconstruirse (con andamios a la vista); sus gentes no te atienden mientras tanto. Si acabas con la horda, apagan los fuegos y te recompensan.
- **Zonas seguras**: castillo, Villa Real (incluido el puente del foso), Altamira, aldeas, granjas, molinos, corrales y cementerios, con un margen alrededor. Ahí los monstruos no entran ni atacan. Tras matar a uno, pasa un rato antes de que aparezcan más.
- **Torretas**: torres de madera (una junto a la salida sur de Villa Real y otras en Altamira y algunas aldeas). Sube por la escalera de mano (E) y lanza lanzas de fuego con clic o ESPACIO.
- **Música medieval**: se compone sola mientras juegas (laúd, flauta, pandero y bordón). Danza alegre de día, más calmada de noche y oscura en las catacumbas. N para silenciarla.
- **Efectos de sonido**: lluvia y truenos, pasos según el suelo (hierba, ramitas del bosque, piedra, madera, arena), cascos del caballo, espada, flechas y lanzas de fuego, golpes, monedas, pociones, comer, subir de nivel, telarañas, traqueteo del vagón y crepitar de la hoguera. V para silenciarlos.
- **Caballos**: caballerizas junto a Villa Real y Altamira, y dos caballos salvajes sueltos por el reino. Acércate y pulsa E para montar (vas casi el doble de rápido); E para bajar.
- **Jardines**: setos, macizos de flores y fuente con chorro. Dos junto al palacio, dentro de la muralla del castillo, y otros cerca de Altamira y de algunas aldeas.
- **Campamentos**: de noche los aldeanos se reúnen alrededor de una hoguera junto a cada población a charlar, brindar y comer, y de vez en cuando sueltan farolillos de papel que suben al cielo.
- **Tren de las catacumbas**: vías unen las entradas de las ciudades. Ponte junto a un vagón y pulsa E para viajar hasta la otra punta. Montado, haz clic (o ESPACIO) para lanzar lanzas de fuego, que atraviesan a los monstruos; el vagón arrolla a los que se quedan en la vía.
- **Cementerio de Villa Real**: pequeño, junto a la ciudad de inicio (sal por la calle principal). Desde su cripta se baja a las catacumbas y al tren.
- **Telarañas**: por el bosque, en las esquinas de las catacumbas (muchas en el nido de la araña), de los muros del cementerio y de las lápidas. Si pasas a través se rompen en hilos que caen flotando; al rato vuelven a tejerse.
- **Cementerio de Altamira**: en el bosque cerca de la gran ciudad, con tumbas, cipreses, niebla nocturna y esqueletos de noche. El mausoleo esconde otra entrada a las catacumbas.
- **Establos con ovejas**: corrales junto a Villa Real, Altamira y algunas aldeas. Las ovejas no salen del vallado y, si las matas, dan carne (+45 de comida).
- **Monstruos** (goblins, lobos, bandidos, osos, orcos, esqueletos): más fuertes cuanto más lejos del castillo y más agresivos de noche.
- **El DRAGÓN** en su guarida de las montañas: lanza bolas de fuego (tres a la vez cuando está herido). ¡Esquiva con Shift!
- **Vista 3/4 con perspectiva**: murallas con almenas, torres, casas altas con tejado a dos aguas y fachada (ventanas que brillan de noche), árboles con tronco y montañas con acantilados. Lo alto se inclina desde el centro de la cámara, así se ven los laterales. Lo que está delante tapa lo de detrás; si el caballero queda oculto se ve su silueta.
- **Interiores en 3D**: al entrar, la pared del fondo se alza con sus vigas, ventanas y decoración, y la delantera se recorta como en una casa de muñecas. En las casas de dos plantas, al subir ves la planta de arriba elevada y la de abajo por delante. Todas las puertas están en la fachada.
- **Palacio real**: dos plantas con salón del trono, comedor, cocina, biblioteca, sala de guardia y aposentos con el tesoro; azotea almenada con cuatro torreones.
- **Viento**: ráfagas que recorren la hierba, árboles que se mecen y hojas que vuelan (más fuerte con lluvia).
- **Bosques variados**: robles, robles grandes, abedules, arbustos con bayas, árboles secos, sauces junto al agua, pinos y cipreses; rocas en bosques, colinas y ríos.
- **Ríos con meandros**, recovecos y pozas; caminos sinuosos.
- **Antorcha**: de noche el caballero lleva una antorcha encendida.
- **Fauna**: enjambres de luciérnagas en los claros del bosque que se dispersan al pasar, luciérnagas de noche y mariposas de día que huyen al acercarte, y bandadas de pájaros que echan a volar.
- **Muralla de piedra**: sillares irregulares con musgo, hiedra y grietas, almenas en 3D, contrafuertes y escombros al pie.
- **Ciclo día/noche** con antorchas y faroles, y **lluvia con relámpagos**.

Si caes en combate, reapareces en el castillo perdiendo la mitad de tu oro.

Cada partida genera un mundo nuevo (tarda unos segundos en generarse).

## Galería de personajes

Abre http://localhost:8123/?galeria para ver todas las figuras animadas (ESPACIO cambia entre quieto, andando y atacando; F las gira).

## Estructura

- `js/render.js`: renderizador WebGL2 (rejilla de caracteres instanciada + capa fina a doble resolución para los personajes + bloom)
- `js/world.js`: generación del mapa (terreno, ríos, castillo, aldeas, caminos, guarida)
- `js/terrain.js`: convierte el mapa en texturas ASCII a nivel de carácter (árboles sombreados, relieve, agua, luces)
- `js/rig.js`: personajes "esculpidos": primitivas con volumen, animadas y sombreadas como una imagen 3D convertida a ASCII
- `js/sprites.js`: sprites ASCII fijos (cofre)
- `js/nature.js`: viento y fauna (luciérnagas, mariposas, pájaros)
- `js/view3d.js`: vista 3/4 (barrido de norte a sur con alturas, árboles y fachadas)
- `js/catacombs.js`: generación de las catacumbas
- `js/train.js`: vagones, vías y lanza de fuego
- `js/sheep.js`: corrales y ovejas
- `js/webs.js`: telarañas que se rompen al pasar
- `js/horses.js`: caballos y montar
- `js/witch.js`: la bruja, las pociones de fuego, las setas y el gólem
- `js/ground.js`: charcos, salpicaduras, reflejos y bichos del bosque
- `js/nightlife.js`: murciélagos, fuegos fatuos, setas, luna en el agua y ventanas encendidas
- `js/village.js`: hogueras, farolillos y fuentes
- `js/raids.js`: ataques de hordas a los pueblos
- `js/music.js`: música medieval generada con Web Audio
- `js/sfx.js`: efectos de sonido sintetizados
- `js/levels.js`: cambio entre la superficie y las catacumbas
- `js/save.js`: guardar y cargar partida
- `js/homes.js`: casas con pisos y tejados, huertos y hambre
- `js/main.js`: bucle de juego, combate, IA, clima, interfaz
- `v1/`: la primera versión, por turnos
