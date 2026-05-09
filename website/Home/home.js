const filterButtons = document.querySelectorAll(".filter-button");
const visualCards = document.querySelectorAll(".visual-card");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));

    visualCards.forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.tool === filter;
      card.classList.toggle("is-hidden", !shouldShow);
    });
  });
});
