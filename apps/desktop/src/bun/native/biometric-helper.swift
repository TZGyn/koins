import Foundation
import LocalAuthentication

let context = LAContext()
var error: NSError?
let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)

let isCheck = CommandLine.arguments.contains("--check")
if isCheck {
    print(available)
    exit(available ? 0 : 1)
}

guard available else {
    print(error!.localizedDescription)
    exit(1)
}

let reason = CommandLine.arguments.last ?? "Authenticate"
let sem = DispatchSemaphore(value: 0)

context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
    if success {
        exit(0)
    }
    if let err = authError {
        print(err.localizedDescription)
    }
    exit(1)
}

_ = sem.wait(timeout: .distantFuture)
