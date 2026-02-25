# Verificación de Campañas Automáticas

## Estado
✅ **Completado y Verificado**

El módulo de campañas ahora funciona de manera totalmente automática. El servidor revisa cada 60 segundos si hay mensajes programados y los envía usando la API de BuilderBot Cloud.

## Configuración Clave (BuilderBot Cloud V2)

Para referencia futura, la integración con BuilderBot Cloud (versión V2) requirió estos ajustes específicos en [backend/server.js](file:///c:/Users/Josor/Documents/App%20OpenSource/backend/server.js):

1.  **Header de Autenticación**:
    -   No usa `x-api-key` ni `Authorization`.
    -   Usa: `x-api-builderbot: <API_KEY>`

2.  **Estructura del Body**:
    -   No acepta un array de mensajes directamente ni un string simple.
    -   Requiere un objeto con la propiedad `messages` que a su vez es un objeto (o array de objetos) con `content`:
        ```json
        {
          "number": "50212345678",
          "messages": {
             "content": "Hola mundo"
          }
        }
        ```

3.  **Envío Individual**:
    -   La API envía mensaje por mensaje, por lo que el backend itera sobre la lista de números (`for ... of`) respetando el `delay` configurado.

## Historial de Solución de Problemas

-   **Error `ENOTFOUND`**: La URL en [.env](file:///c:/Users/Josor/Documents/App%20OpenSource/.env) tenía espacios al inicio. Se corrigió limpiando el archivo.
-   **Error `401 Unauthorized`**: Se estaba usando el header incorrecto (`api-key`). Se corrigió a `x-api-builderbot` tras revisar el panel del usuario.
-   **Error `400 Bad Request`**: Se estaba enviando el formato JSON incorrecto. Se corrigió mediante scripts de depuración hasta dar con la estructura aceptada.

## Cómo usar

1.  Ir a pestaña **Campañas**.
2.  Crear campaña con fecha futura.
3.  Esperar. El sistema lo procesará automáticamente.
