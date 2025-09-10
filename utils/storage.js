import multer from "multer"
import path from "path"

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./temp/imagenes")
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || ".png";
        cb(null, `${file.fieldname}-${Date.now()}${ext}`)
    }
})

const upload = multer({ storage })

export default upload