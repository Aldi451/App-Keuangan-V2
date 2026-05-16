var supabaseUrl = "https://qtcdtudnzlvrvtyyygwa.supabase.co";
var supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Y2R0dWRuemx2cnZ0eXl5Z3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjEzMzAsImV4cCI6MjA4ODc5NzMzMH0.gVHcnBmD06MAMf7kw4QqHZZapuLqZ03Bqh4lFCPCu3k";

var supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

function togglePassword(id){

let input=document.getElementById(id);

if(input.type==="password"){
input.type="text";
}else{
input.type="password";
}

}

async function register(){

let username=document.getElementById("username").value;
let email=document.getElementById("email").value;
let phone=document.getElementById("phone").value;
let password=document.getElementById("password").value;

if(!username||!email||!phone||!password){
alert("Semua field wajib diisi");
return;
}

// Check if username or email already exists
const { data: existingUser, error: checkError } = await supabaseClient
    .from("users")
    .select("username, email")
    .or(`username.eq.${username},email.eq.${email}`);

if (existingUser && existingUser.length > 0) {
    const isEmailTaken = existingUser.some(u => u.email === email);
    if (isEmailTaken) {
        alert("Pendaftaran gagal: Email sudah terdaftar.");
    } else {
        alert("Pendaftaran gagal: Username sudah digunakan.");
    }
    return;
}

const {error}=await supabaseClient
.from("users")
.insert([{username,email,phone,password}]);

if(error){
alert("Register gagal: " + error.message);
console.log(error);
return;
}

    alert("Register berhasil! Silakan login.");
    window.location.href = "login.html";
}

async function login(){
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    if(!username || !password) {
        alert("Harap isi username dan password");
        return;
    }

    const {data, error} = await supabaseClient
        .from("users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single();

    if(error || !data){
        alert("Username atau password salah!");
        return;
    }

    localStorage.setItem("user", JSON.stringify(data));
    window.location.href = "index.html";
}

async function lupaPassword(){
    let input = document.getElementById("resetInput").value;
    
    if(!input) {
        alert("Harap masukkan Email atau No HP");
        return;
    }

    const {data, error} = await supabaseClient
        .from("users")
        .select("*")
        .or(`email.eq.${input},phone.eq.${input}`);

    if(error || !data || data.length === 0){
        alert("Data tidak ditemukan di sistem kami.");
        return;
    }

    alert("Permintaan reset berhasil. Silakan cek email/SMS Anda.");
    window.location.href = "login.html";
}

function logout(){

localStorage.removeItem("user");

window.location.href="index.html";

}
