(() => {
  const imageRules = [
    {
      pattern: /\b(?:tata|ril[\s-]?12|dream)\b|टाटा/i,
      image: "/assets/images/tata%20wheet.jpeg"
    },
    {
      pattern: /\b(?:mustard|musterd|sarson)\b|सरसों/i,
      image: "/assets/images/musterd%20seeds.jpeg"
    },
    {
      pattern: /\b(?:pea|peas|matar)\b|मटर/i,
      image: "/assets/images/pea.jpeg"
    },
    {
      pattern: /\b(?:pesticide|pestiside|insecticide|fungicide)\b|कीटनाशक/i,
      image: "/assets/images/pestiside%20.jpeg"
    },
    {
      pattern: /\b(?:wheat|wheet)\b|गेहूं|गेहूँ|गेंहू/i,
      image: "/assets/images/wheet.jpeg"
    }
  ];

  window.getProductImage = product => {
    if (product.image) return product.image;

    const details = `${product.name || ""} ${product.description || ""} ${product.category || ""}`;
    const match = imageRules.find(rule => rule.pattern.test(details));
    return match ? match.image : "/assets/images/product-placeholder.svg";
  };
})();
