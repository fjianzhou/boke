var http= require('http');
var path=require('path');
var url=require('url');
var querystring=require('querystring');
var fs=require('fs');
var formidable=require('formidable');
var mime=require('mime');
var cookieParser = require('./cookieParser');
var currentUser={}; //系统中存储session数据的地方
var EXPIRE_TIME=5*1000;  //过期时间是5秒  根据个人需求调整
var key='boke';



var server =http.createServer();

server.on('connection',function(){

    console.log('连接');
});


server.on('request',function(req,res){
    var now=Date.now(); //时间撮  为生成一个唯一的sessionid
    var objectUrl=url.parse(req.url,true);  //将查询字符串格式化成json格式
    var pathName=objectUrl.pathname;  //访问路径
    var queryPar=objectUrl.query;   //路径中的查询字符串
    //console.log(pathName);
    var cookieObj = querystring.parse(req.headers.cookie,'; '); //得到请求中的cookie 并转换成字符串
    var sessionId = cookieObj[key];//通过规定的key键得到sessionId
    var sessionObj = currentUser[sessionId];//通过sessionId得到session中的值

    //处理请求根目录和login.html 的请求
    if(pathName=='/' || pathName=='/login.html'){
        res.setHeader('Content-Type',mime.lookup('login.html'));
        var htmltem='<ul class="nav navbar-nav navbar-right">';
        htmltem+='<button type="button" class="btn btn-default navbar-btn" onclick="{window.location.href=\'login.html\'}">登录</button>'
        htmltem+='<button type="button" class="btn btn-primary navbar-btn" onclick="{window.location.href=\'reg.html\'}">注册</button>'
        htmltem+='</ul>'
        var htmlstr=fs.readFileSync('./login.html','utf8');
        htmlstr=htmlstr.replace("@login",htmltem);

        htmlstr= htmlstr.replace("@navContent","");
        htmlstr= htmlstr.replace("@userMessage","");
        res.end(htmlstr);
    }
    //以ajax开的请求处理
    else if(pathName=='/ajax')
    {
        var submitform=formidable.IncomingForm(); //报文格式化工具
        //注册的请求的处理方法
        if(queryPar.action=='reg')  //根据action参数判断具体操作
        {
            //将报文体 中form表单里提交的数据转换成JSON fields上传的字段和对应的值（名字和密码） files表示上传的文件（头像）
            submitform.parse(req, function (err, fields, files) {
                //头像保存路径s
                var avatarFileSrc='./upload/'+files.avatar.name;
                //得到上传文件的路径将其保存到头像文件夹
                fs.createReadStream(files.avatar.path).pipe(fs.createWriteStream(avatarFileSrc));
                //将注册的用户保存到txt文本中
                var userMessage=';user='+fields.loginName+"&pwd="+fields.loginPwd+"&avatar="+files.avatar.name;
                fs.appendFileSync('./userList.txt',userMessage,'utf-8');
                //用户注册成功后跳转到登录页面
                //表示重定向的状态码  类似于404  当状态标记为302时 页面收到请求后自动调用header中的Location页面自动实现跳转
                res.statusCode=302;
                res.setHeader("Location","login.html")
                res.end();
            });
        }
        //登录处理的方法
        else if(queryPar.action=='login')
        {
            //读取所有用户
            var userTemStr=fs.readFileSync('./userList.txt','utf-8');
            //userTemStr 等于空表示系统里没用户直接返回no值
            if(userTemStr!='') {
                //;user=wwww&pwd=2222&avatar=secondarytile.png;user=qweqwe&pwd=2222&avatar=secondarytile.pn
                //把用户信息按;号分格 并去掉第一个空用户
                var usersStr=userTemStr.split(';').slice(1);
                //循环所有用户。。看看有没有和前台输入一直的用户名和密码  如果有登录成功。。
                usersStr.forEach(function (item) {
                    //将用户数据转换成JSON
                    item=querystring.parse(item);
                    //console.log('item.user='+item.user+" loginName "+queryPar.loginName+"  tem.pwd"+item.pwd+"  loginPwd"+queryPar.loginPwd)
                    //判断用户是否存在
                    if(item.user==queryPar.loginName && item.pwd==queryPar.loginPwd)
                    {
                        //防止同一用户多次登录 session中会保存多个用户信息
                        delete currentUser[sessionId];  //删除多余用户信息

                        item.expTime=new Date(new  Date().getTime()+EXPIRE_TIME);//session的过期时间
                        var sessionObj=item; //的用户信息
                        sessionId=now+'_'+Math.random(); //生成一个随机唯一的sessionId值
                        currentUser[sessionId]=sessionObj;//用户保存到session中
                        //将sessionId 传给客户段的cookie中
                        res.writeHead(200,{"Set-Cookie":cookieParser.serialize(key,sessionId,{maxAge:30*60})});
                        res.end('ok'); //ok表示登录成功 （调用login.html js方法login（））
                    }
                    else{
                        res.end('no');//no表示登录不成功
                    }
                });
            }
            else{
                res.end('no');//no表示登录不成功
            }

        }
        //安全退出
        else if(queryPar.action=='exit'){
            //清除session中的用户信息  以防session被多余的用户信息撑爆（session内存过大问题）
            delete currentUser[sessionId]; //用sessionId删除对应的用户
            //if(sessionObj){
            //    sessionObj.expTime=new Date(new Date().getTime()+EXPIRE_TIME);
            //}
            //重定向跳转
            res.statusCode=302;
            res.setHeader('Location','./login.html')
            return res.end() ;

        }
        else
        {

        }
    }
    //处理 请求 favicon.ico
    else if(pathName=='/favicon.ico')
    {
        res.statusCode=404;
        res.end(http.STATUS_CODES[404]);
    }
    //处理其他请求 如*.html   *.css  *.js  和图片
    else
    {
        //判断请求存路径是否存在  不存在直接返回404
        if(fs.existsSync('.'+pathName))
        {
            //根据文件名称 设置返回内容的格式
            res.setHeader('Content-Type',mime.lookup(pathName));
            var htmlstr="";
            //不是html文件直接读取并返回给客户端 如果是html文件要进行拼装把内容替换一下
            if(path.extname(pathName)!='.html')
            {
                return res.end( fs.readFileSync('.'+pathName));
            }

            //判断用户信息是否存在   是否有过期时间   过期时间是否过期（也就是判断session是否过期）
            if(sessionObj && sessionObj.expTime && sessionObj.expTime.getTime()>now )
            {
                var htmltem='<ul class="nav navbar-nav navbar-right">';
                htmltem+= '<li class="dropdown">';
                htmltem+='<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">';
                htmltem+='<img src="/upload/'+sessionObj.avatar+'" style=" width: 20px; height: 20px; " />';
                htmltem+='<span class="caret"></span></a>';
                htmltem+='<ul class="dropdown-menu">';
                htmltem+='<li><a href="/ajax?action=exit">安全退出</a></li></ul></li></ul>';

                var htmlstr=fs.readFileSync('.'+pathName,'utf8').replace("@userMessage",htmltem);
                htmltem='<li class="active" ><a  href=\'list.html\'>文章列表</a></li>';
                htmltem+='<li ><a href=\'addArticle.html\'>文章发布</a></li>';
                htmlstr= htmlstr.replace("@navContent",htmltem);
                htmlstr=htmlstr.replace("@login","");
                //用户请求一次就应该把session过期时间重新设定一下
                if(sessionObj){
                    //当前时间加设定好的最大过期时间EXPIRE_TIME
                    sessionObj.expTime=new Date(new Date().getTime()+EXPIRE_TIME);
                }
            }
            //session过期或者第一次登录（如果没有用户信息也就是客户没有登录
            //那就只能访问reg.html 和index.html页面  如果访问其他页面将自动跳转到登录页面）
            else
            {
                //reg.html 正常返回
                if(pathName=='/reg.html'){
                    res.setHeader('Content-Type',mime.lookup('login.html'));
                    var htmltem='<ul class="nav navbar-nav navbar-right">';
                    htmltem+='<button type="button" class="btn btn-default navbar-btn" onclick="{window.location.href=\'login.html\'}">登录</button>'
                    htmltem+='<button type="button" class="btn btn-primary navbar-btn" onclick="{window.location.href=\'reg.html\'}">注册</button>'
                    htmltem+='</ul>'
                    htmlstr=fs.readFileSync('./'+pathName,'utf8');
                    htmlstr=htmlstr.replace("@login",htmltem);
                    htmlstr= htmlstr.replace("@navContent",htmltem);
                    htmlstr= htmlstr.replace("@userMessage","");
                }
                else
                {
                    //重定向跳转到登录页面
                    res.statusCode=302;
                    res.setHeader("Location","login.html");
                    res.end();
                    return;
                }

            }

            res.end(htmlstr);
            //fs.createReadStream('.'+pathName).pipe(res);
        }
        else
        {
            res.status=404;
            res.end(http.STATUS_CODES[404]);
        }
    }
});

server.listen(8080)

