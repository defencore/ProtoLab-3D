# Flanged optical dome window

The [user-supplied image](../../../public/references/nose-optical-dome-user-reference.png) specifies a 2.3 cm outside flange, 1.7 cm dome diameter and 0.6 cm overall height. The preset converts those dimensions to 23, 17 and 6 mm. No supplier model is established.

## Coordinates and construction

The flange underside is at Z=0, and the optical axis points along +Z. The maximum XY envelope is the flange diameter; the outer apex is at Z=`height`. The flat annular flange extends from Z=0 to `flangeThickness`; a spherical cap begins at that upper plane. The inner spherical surface is concentric with the outer one, reduced by `wall`, and meets the underside plane to leave an open rear aperture. One closed revolved profile gives one solid for preview and native FreeCAD export. Curves use 64 meridional segments and 128 circumferential segments in the preview. Native CAD revolves the same sampled meridian.

The default 1 mm flange and 1 mm shell thickness are fitting assumptions. They are not measurements from the image. The photo does not distinguish a protective cover from a powered optical lens, and does not establish focal length, refractive index, coating, distortion, material or transmission. Preview transparency is illustrative. Qualify optics, actual dimensions, sealing, retention and loads using the purchased item.
