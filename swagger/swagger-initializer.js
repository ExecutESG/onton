window.onload = function() {
  window.ui = SwaggerUIBundle({
    // List multiple specs via `urls`
    urls: [
      { url: "./ExternalSeller.yaml", name: "External Seller API" },
      { url: "./GameRewards.yaml", name: "Game Rewards API" },
      { url: "./NFTApi.yaml", name: "NFT API" },
    ],

    // The ID of the DOM element where Swagger UI will render
    dom_id: "#swagger-ui",

    // Deep linking allows you to share links to specific operations
    deepLinking: true,

    // Use the StandaloneLayout (requires the StandalonePreset in `presets`)
    layout: "StandaloneLayout",

    // Must include SwaggerUIStandalonePreset for `StandaloneLayout` to work
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset,
    ],

    // Optional: allows "Download" button for the docs
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl,
    ],
  });
};
