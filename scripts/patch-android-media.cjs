/**
 * Patches @capacitor-community/media MediaPlugin.java on Android during APK build
 * so getAlbums(), getMedias() (with offset pagination), getMediaByIdentifier(),
 * and savePublicFile() (MediaStore Pictures/PGE-DocuTek & Download/PGE-DocuTek)
 * work natively on Android 8–15.
 */
const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'node_modules',
  '@capacitor-community',
  'media',
  'android',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'community',
  'media',
  'MediaPlugin.java'
);

if (!fs.existsSync(targetPath)) {
  console.log('MediaPlugin.java not found at:', targetPath);
  process.exit(0);
}

let java = fs.readFileSync(targetPath, 'utf8');

if (java.includes('__PGE_MEDIA_PATCHED_V2__')) {
  console.log('MediaPlugin.java already patched (v2).');
  process.exit(0);
}

// 1. Ensure needed Android imports are present
const neededImports = [
  'import android.content.ContentResolver;',
  'import android.content.ContentValues;',
  'import android.graphics.Bitmap;',
  'import android.graphics.BitmapFactory;',
  'import android.graphics.Matrix;',
  'import android.media.ExifInterface;',
  'import java.io.ByteArrayOutputStream;',
  'import java.util.Locale;',
  'import java.util.TimeZone;',
];

for (const imp of neededImports) {
  if (!java.includes(imp)) {
    java = java.replace('import android.Manifest;', 'import android.Manifest;\n' + imp);
  }
}

// 2. Update @Permission publicStorage13Plus so only READ_MEDIA_IMAGES is required
java = java.replace(
  'strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO },',
  'strings = { Manifest.permission.READ_MEDIA_IMAGES },'
);

// 3. Update publicStorage on Android <=12 to check READ_EXTERNAL_STORAGE cleanly
java = java.replace(
  'strings = { Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE },',
  'strings = { Manifest.permission.READ_EXTERNAL_STORAGE },'
);

// 4. Replace unimplemented getMedias & getMediaByIdentifier with full Android MediaStore implementation
const getMediasTarget = `    // @todo
    @PluginMethod
    public void getMedias(PluginCall call) {
        call.unimplemented();
    }

    @PluginMethod
    public void getMediaByIdentifier(PluginCall call) {
        call.unimplemented("No need to do this on Android -- the identifier is the file path.");
    }`;

const getMediasReplacement = `    // __PGE_MEDIA_PATCHED_V2__
    @PluginMethod
    public void getMedias(PluginCall call) {
        if (isStoragePermissionGranted()) {
            _getMedias(call);
        } else {
            this.bridge.saveCall(call);
            requestAllPermissions(call, "permissionCallback");
        }
    }

    @PluginMethod
    public void getMediaByIdentifier(PluginCall call) {
        if (!isStoragePermissionGranted()) {
            this.bridge.saveCall(call);
            requestAllPermissions(call, "permissionCallback");
            return;
        }
        _getMediaByIdentifier(call);
    }

    @PluginMethod
    public void savePublicFile(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && !isStoragePermissionGranted()) {
            this.bridge.saveCall(call);
            requestAllPermissions(call, "permissionCallback");
            return;
        }
        _savePublicFile(call);
    }`;

if (java.includes(getMediasTarget)) {
  java = java.replace(getMediasTarget, getMediasReplacement);
}

// 5. Update permissionCallback switch
java = java.replace(
  'case "getMedias" -> call.unimplemented();',
  'case "getMedias" -> _getMedias(call);\n            case "getMediaByIdentifier" -> _getMediaByIdentifier(call);\n            case "savePublicFile" -> _savePublicFile(call);'
);

// 6. Harden _getAlbums against null cursors / null listFiles()
if (!java.includes('if (cur == null) continue;')) {
  java = java.replace(
    `        for (Cursor cur : curs) {
            while (cur.moveToNext()) {`,
    `        for (Cursor cur : curs) {
            if (cur == null) continue;
            while (cur.moveToNext()) {`
  );
}

if (!java.includes('File[] subDirs = albumPath.listFiles();')) {
  java = java.replace(
    `        File albumPath = new File(_getAlbumsPath());
        for (File sub : albumPath.listFiles()) {`,
    `        File albumPath = new File(_getAlbumsPath());
        File[] subDirs = albumPath.listFiles();
        if (subDirs != null) {
        for (File sub : subDirs) {`
  );

  java = java.replace(
    `                albums.put(album);
            }
        }

        response.put("albums", albums);`,
    `                albums.put(album);
            }
        }
        }` + '\n\n        response.put("albums", albums);'
  );
}

// 7. Inject _getMedias (with offset), _getMediaByIdentifier, _savePublicFile, and helpers
const mediaHelpers = `
    private void _getMedias(PluginCall call) {
        try {
            int quantity = call.getInt("quantity", 30);
            int offset = Math.max(0, call.getInt("offset", 0));
            int thumbWidth = call.getInt("thumbnailWidth", 250);
            int thumbHeight = call.getInt("thumbnailHeight", 250);
            int thumbQuality = call.getInt("thumbnailQuality", 60);
            String albumIdentifier = call.getString("albumIdentifier", null);

            String sortOrder = MediaStore.Images.Media.DATE_MODIFIED + " DESC, " + MediaStore.Images.Media._ID + " DESC";
            String selection = null;
            String[] selectionArgs = null;

            if (albumIdentifier != null && !albumIdentifier.trim().isEmpty()) {
                selection = MediaStore.Images.Media.DATA + " LIKE ?";
                selectionArgs = new String[] { albumIdentifier + "/%" };
            }

            String[] projection = new String[] {
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.DATE_TAKEN,
                MediaStore.Images.Media.DATE_MODIFIED,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT
            };

            Uri imageUri = isGalleryMode()
                ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                : MediaStore.Images.Media.INTERNAL_CONTENT_URI;

            JSArray medias = new JSArray();
            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
            int matchedCount = 0;

            try (Cursor cur = getActivity().getContentResolver().query(imageUri, projection, selection, selectionArgs, sortOrder)) {
                if (cur != null) {
                    int dataIdx = cur.getColumnIndex(MediaStore.Images.Media.DATA);
                    int dateTakenIdx = cur.getColumnIndex(MediaStore.Images.Media.DATE_TAKEN);
                    int dateModIdx = cur.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED);
                    int widthIdx = cur.getColumnIndex(MediaStore.Images.Media.WIDTH);
                    int heightIdx = cur.getColumnIndex(MediaStore.Images.Media.HEIGHT);

                    while (cur.moveToNext() && medias.length() < quantity) {
                        if (dataIdx < 0) continue;
                        String filePath = cur.getString(dataIdx);
                        if (filePath == null || filePath.isEmpty()) continue;

                        File f = new File(filePath);
                        if (!f.exists() || !f.isFile()) continue;

                        if (albumIdentifier != null && !albumIdentifier.trim().isEmpty()) {
                            String parent = f.getParent();
                            if (parent == null || !parent.equals(albumIdentifier)) {
                                continue;
                            }
                        }

                        if (matchedCount < offset) {
                            matchedCount++;
                            continue;
                        }
                        matchedCount++;

                        long dateMs = 0L;
                        if (dateTakenIdx >= 0) {
                            dateMs = cur.getLong(dateTakenIdx);
                        }
                        if (dateMs <= 0L && dateModIdx >= 0) {
                            dateMs = cur.getLong(dateModIdx) * 1000L;
                        }
                        if (dateMs <= 0L) {
                            dateMs = f.lastModified();
                        }

                        int fullW = widthIdx >= 0 ? cur.getInt(widthIdx) : 0;
                        int fullH = heightIdx >= 0 ? cur.getInt(heightIdx) : 0;

                        String thumbBase64 = encodeThumbnailBase64(filePath, thumbWidth, thumbHeight, thumbQuality);
                        if (thumbBase64 == null) continue;

                        JSObject item = new JSObject();
                        item.put("identifier", filePath);
                        item.put("data", thumbBase64);
                        item.put("creationDate", isoFormat.format(new Date(dateMs)));
                        item.put("fullWidth", fullW);
                        item.put("fullHeight", fullH);
                        item.put("thumbnailWidth", thumbWidth);
                        item.put("thumbnailHeight", thumbHeight);

                        JSObject loc = new JSObject();
                        loc.put("latitude", 0);
                        loc.put("longitude", 0);
                        loc.put("heading", 0);
                        loc.put("altitude", 0);
                        loc.put("speed", 0);
                        item.put("location", loc);

                        medias.put(item);
                    }
                }
            }

            JSObject result = new JSObject();
            result.put("medias", medias);
            call.resolve(result);
        } catch (Exception ex) {
            Log.e("MediaPlugin", "Error in _getMedias", ex);
            call.reject("Gagal membaca media lokal: " + ex.getMessage(), EC_FS_ERROR);
        }
    }

    private void _getMediaByIdentifier(PluginCall call) {
        String identifier = call.getString("identifier");
        if (identifier == null || identifier.trim().isEmpty()) {
            call.reject("identifier is required", EC_ARG_ERROR);
            return;
        }
        try {
            File f = new File(identifier);
            if (!f.exists()) {
                call.reject("Media file not found", EC_FS_ERROR);
                return;
            }
            String base64 = encodeThumbnailBase64(identifier, 1000, 1000, 80);
            JSObject result = new JSObject();
            result.put("identifier", identifier);
            result.put("path", identifier);
            if (base64 != null) {
                result.put("data", base64);
            }
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Error reading media: " + ex.getMessage(), EC_FS_ERROR);
        }
    }

    private void _savePublicFile(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String relativeFolder = call.getString("folder", "Download/PGE-DocuTek");

        if (base64Data == null || fileName == null) {
            call.reject("base64Data and fileName are required", EC_ARG_ERROR);
            return;
        }

        try {
            String cleanBase64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
            byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            boolean isImage = mimeType.startsWith("image/");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativeFolder);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri collection = isImage
                    ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    : MediaStore.Downloads.EXTERNAL_CONTENT_URI;

                Uri itemUri = resolver.insert(collection, values);
                if (itemUri == null) {
                    call.reject("Gagal membuat entri MediaStore", EC_FS_ERROR);
                    return;
                }

                try (OutputStream out = resolver.openOutputStream(itemUri)) {
                    if (out == null) {
                        call.reject("Gagal membuka output stream", EC_FS_ERROR);
                        return;
                    }
                    out.write(bytes);
                }

                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(itemUri, values, null, null);

                JSObject res = new JSObject();
                res.put("uri", itemUri.toString());
                res.put("folder", relativeFolder);
                call.resolve(res);
                return;
            }

            // Android <= 9 fallback
            File baseDir = isImage
                ? Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                : Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File targetDir = new File(baseDir, "PGE-DocuTek");
            if (!targetDir.exists()) {
                targetDir.mkdirs();
            }
            File outFile = new File(targetDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(bytes);
            }
            if (isImage) {
                scanPhoto(outFile);
            }

            JSObject res = new JSObject();
            res.put("uri", Uri.fromFile(outFile).toString());
            res.put("folder", relativeFolder);
            call.resolve(res);
        } catch (Exception ex) {
            Log.e("MediaPlugin", "Error in _savePublicFile", ex);
            call.reject("Gagal menyimpan file ke penyimpanan publik: " + ex.getMessage(), EC_FS_ERROR);
        }
    }

    private String encodeThumbnailBase64(String filePath, int reqW, int reqH, int quality) {
        try {
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(filePath, opts);
            int srcW = opts.outWidth;
            int srcH = opts.outHeight;
            if (srcW <= 0 || srcH <= 0) return null;

            int inSampleSize = 1;
            int targetW = Math.max(120, reqW);
            int targetH = Math.max(120, reqH);
            while ((srcW / (inSampleSize * 2)) >= targetW && (srcH / (inSampleSize * 2)) >= targetH) {
                inSampleSize *= 2;
            }

            BitmapFactory.Options decodeOpts = new BitmapFactory.Options();
            decodeOpts.inSampleSize = inSampleSize;
            Bitmap bmp = BitmapFactory.decodeFile(filePath, decodeOpts);
            if (bmp == null) return null;

            try {
                ExifInterface exif = new ExifInterface(filePath);
                int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                int angle = 0;
                if (orientation == ExifInterface.ORIENTATION_ROTATE_90) angle = 90;
                else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) angle = 180;
                else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) angle = 270;
                if (angle != 0) {
                    Matrix m = new Matrix();
                    m.postRotate(angle);
                    Bitmap rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
                    if (rotated != bmp) {
                        bmp.recycle();
                        bmp = rotated;
                    }
                }
            } catch (Exception ignored) {}

            int curW = bmp.getWidth();
            int curH = bmp.getHeight();
            int maxDim = Math.max(targetW, targetH);
            if (curW > maxDim || curH > maxDim) {
                float scale = Math.min((float) maxDim / curW, (float) maxDim / curH);
                int newW = Math.max(1, Math.round(curW * scale));
                int newH = Math.max(1, Math.round(curH * scale));
                Bitmap scaled = Bitmap.createScaledBitmap(bmp, newW, newH, true);
                if (scaled != bmp) {
                    bmp.recycle();
                    bmp = scaled;
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, Math.min(95, Math.max(40, quality)), baos);
            bmp.recycle();
            return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e("MediaPlugin", "encodeThumbnailBase64 failed for " + filePath, e);
            return null;
        }
    }
}
`;

// If previously patched v1, reset cleanly by finding first _getMedias or last brace
const prevV1Marker = java.indexOf('    private void _getMedias(PluginCall call)');
if (prevV1Marker !== -1) {
  java = java.slice(0, prevV1Marker) + mediaHelpers;
} else {
  const lastBrace = java.lastIndexOf('}');
  if (lastBrace === -1) {
    throw new Error('Malformed MediaPlugin.java: missing closing brace');
  }
  java = java.slice(0, lastBrace) + mediaHelpers;
}

fs.writeFileSync(targetPath, java, 'utf8');
console.log('Successfully patched MediaPlugin.java (v2) with paginated getMedias & MediaStore savePublicFile.');
