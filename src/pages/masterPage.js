import wixLocation from 'wix-location';

$w.onReady(function () {

  const pagina = wixLocation.path[0];

  if (pagina === "video") {
    $w('#searchAppController3').hide();
  }

});