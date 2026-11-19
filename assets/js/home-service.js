/* WIAN home service request: builds a WhatsApp message from the form. Nothing is sent to or stored by the website. */
(function () {
  var form = document.getElementById("homeService");
  if (!form) return;
  var err = document.getElementById("hsErr");
  var d = document.getElementById("hsDate");
  try { d.min = new Date().toISOString().slice(0, 10); } catch (e) {}
  var val = function (id) { return (document.getElementById(id).value || "").replace(/\s+/g, " ").trim(); };
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var reg = val("hsReg").toUpperCase(), place = val("hsPlace");
    if (!reg || !place) {
      err.textContent = !reg ? "Please enter the car's registration number." : "Please enter the area or village where the car is.";
      err.hidden = false; (!reg ? document.getElementById("hsReg") : document.getElementById("hsPlace")).focus(); return;
    }
    err.hidden = true;
    var lines = [
      "Hi WIAN, I'd like a car service at home.",
      val("hsName") && "Name: " + val("hsName"),
      "Registration: " + reg,
      val("hsCar") && "Car: " + val("hsCar"),
      "Service: " + val("hsService"),
      "Location: " + place + ", " + val("hsArea").replace(/\s*\(.*\)$/, ""),
      "Preferred: " + (val("hsDate") || "any date") + ", " + val("hsSlot"),
      val("hsNotes") && "Notes: " + val("hsNotes")
    ].filter(Boolean);
    window.location.href = "https://wa.me/919108327761?text=" + encodeURIComponent(lines.join("\n"));
  });
})();
