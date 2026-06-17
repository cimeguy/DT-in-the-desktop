import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import AppKit

// 用 macOS 自带 Vision 人物分割,把人物抠成透明 PNG
// 用法: cutout_person <输入图> <输出png>

func die(_ msg: String) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(1)
}

guard CommandLine.arguments.count >= 3 else {
    die("用法: cutout_person <输入图> <输出png>")
}
let inPath = CommandLine.arguments[1]
let outPath = CommandLine.arguments[2]

guard let nsImage = NSImage(contentsOfFile: inPath),
      let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    die("无法读取输入图片: \(inPath)")
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    die("分割失败: \(error)")
}

guard let result = request.results?.first as? VNPixelBufferObservation else {
    die("没有检测到人物")
}

let ciContext = CIContext()
let inputImage = CIImage(cgImage: cgImage)
var maskImage = CIImage(cvPixelBuffer: result.pixelBuffer)

// 把 mask 缩放到原图尺寸
let sx = inputImage.extent.width / maskImage.extent.width
let sy = inputImage.extent.height / maskImage.extent.height
maskImage = maskImage.transformed(by: CGAffineTransform(scaleX: sx, y: sy))

let filter = CIFilter.blendWithMask()
filter.inputImage = inputImage
filter.maskImage = maskImage
filter.backgroundImage = CIImage.empty()

guard let output = filter.outputImage?.cropped(to: inputImage.extent) else {
    die("合成失败")
}

let outURL = URL(fileURLWithPath: outPath)
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
do {
    try ciContext.writePNGRepresentation(of: output, to: outURL, format: .RGBA8, colorSpace: colorSpace)
} catch {
    die("写出 PNG 失败: \(error)")
}
print("完成: \(outPath)")
