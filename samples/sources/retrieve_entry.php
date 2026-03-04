<?php
if(!isset($_GET["data"]["id_news"])){
    return;
}
$id_news = $_GET["data"]["id_news"];

$all = json_decode(file_get_contents("dynamic_list.json"), true);

$news = null;
foreach($all["results"] as $item){
    if($item["id"] == $id_news){
        $news = $item;
    }
}

if(!$news){
    return;
}

include_once("../blocks/news.php");

header("Content-Type: application/json");
echo json_encode(["html"=>$html]);